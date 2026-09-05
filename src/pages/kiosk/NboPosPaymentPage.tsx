import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TerminalTapScreen } from "@/components/kiosk/TerminalTapScreen";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";
import { getCachedNboPosConfig, loadKioskRuntimeConfig } from "@/lib/kioskConfig";
import NboEcr, { type NboPurchaseResult } from "@/services/nboEcrPlugin";
import {
  conditionText,
  isHousekeepingCode,
  recordTransactionCondition,
  setPosTransactionActive,
} from "@/lib/posHealth";

type Stage = "processing" | "declined" | "error";

/**
 * Payment screen for the National Bank of Oman OM-A880 terminal connected to
 * the kiosk over a USB-OTG cable. The amount is pushed to the terminal through
 * the native ECR bridge; the terminal's own response decides whether the
 * donation is billed (approved) or refused (declined).
 */
const NboPosPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "donation";
  const amount = parseFloat(searchParams.get("amount") || "0");
  const kioskId = localStorage.getItem("kiosk_id") || "";

  const [stage, setStage] = useState<Stage>("processing");
  const [errorMessage, setErrorMessage] = useState("");
  const [declineMessage, setDeclineMessage] = useState("");
  const [categoryReference, setCategoryReference] = useState<string>(
    () => readCachedCategory(category)?.category_reference || "",
  );

  const transactionId = useMemo(() => crypto.randomUUID(), []);
  const startedRef = useRef(false);
  const cancellingRef = useRef(false);

  useEffect(() => {
    const fetchCategory = async () => {
      const cached = readCachedCategory(category);
      if (cached?.category_reference) {
        setCategoryReference(cached.category_reference);
        return;
      }
      const { data } = await supabase
        .from("donation_categories")
        .select("*")
        .eq("category_id", category)
        .maybeSingle();
      if (data) {
        storeCategoryInCache(data);
        setCategoryReference(data.category_reference || "");
      }
    };
    void fetchCategory();
  }, [category]);

  const recordTransaction = useCallback(
    async (result: NboPurchaseResult) => {
      const posResponse = {
        success: result.approved,
        responseCode: result.responseCode || (result.approved ? "00" : "05"),
        responseMessage: result.responseText || "",
        rrn: result.rrn || null,
        authCode: result.authCode || null,
        tid: result.tid || null,
        mid: result.mid || null,
        cardType: result.cardType || null,
        cardLastFour: result.cardLastFour || null,
        invoiceNumber: result.invoiceNumber || null,
        raw: result.raw || null,
      };

      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          transactionId,
          kioskId,
          amount,
          category,
          mobileNumber: null,
          paymentType: "nbo_pos",
          provider: "nbo_om_a880",
          posResponse,
        },
      });
      if (error) throw error;
      return data?.transaction?.reference_number || transactionId;
    },
    [amount, category, kioskId, transactionId],
  );

  const startPurchase = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Invalid donation amount. Please select or enter an amount again.");
      setStage("error");
      return;
    }
    if (!kioskId) {
      setErrorMessage("Kiosk is not registered. Please set up the kiosk first.");
      setStage("error");
      return;
    }

    // USB dispatch must not wait for a backend round trip. Use the locally
    // persisted admin configuration and refresh it for the next transaction.
    const nbo = getCachedNboPosConfig(kioskId) || {};
    void loadKioskRuntimeConfig(kioskId, { forceRefresh: true }).catch(() => undefined);

    // Lock out the health heartbeat for the whole terminal dialogue.
    setPosTransactionActive(true);
    try {
      const availability = await NboEcr.isAvailable();
      if (!availability.available || !availability.deviceAttached) {
        setErrorMessage(
          "جهاز الدفع غير متصل. يرجى إبلاغ الموظف المسؤول.\nPOS device is disconnected. Please inform a staff member.",
        );
        setStage("error");
        return;
      }

      const result = await NboEcr.purchase({
        amountBaisas: Math.round(amount),
        transactionId,
        baudRate: nbo.baud_rate || 115200,
        vendorId: nbo.vendor_id || 1478,
        productId: nbo.product_id || 36923,
        timeoutSeconds: nbo.timeout_seconds || 90,
      });

      // Learn paper / battery from the real response instead of polling for it.
      recordTransactionCondition(result.errorCode, result.approved);

      if (result.cancelled) return;


      if (result.approved) {
        // Billing only happens on a terminal-approved transaction.
        let reference = transactionId;
        try {
          reference = await recordTransaction(result);
        } catch (err) {
          console.error("Failed to record NBO transaction:", err);
        }
        const posTransactionNumber = result.rrn || result.invoiceNumber || "";
        navigate(
          `/kiosk/thank-you?category=${category}&amount=${amount}&ref=${encodeURIComponent(reference)}` +
            `&posRef=${encodeURIComponent(posTransactionNumber)}` +
            `&transactionId=${transactionId}&paymentMethod=nbo_pos&catRef=${categoryReference}`,
          { replace: true },
        );
        return;
      }

      if (cancellingRef.current) return;

      if (!result.completed) {
        // Nothing was charged — this is a connection/driver failure. Clear any
        // amount left on the terminal screen before showing the error.
        void NboEcr.cancel().catch(() => undefined);
        setErrorMessage(
          `تعذر الاتصال بجهاز الدفع الإلكتروني عبر كابل USB.\n${result.error || "Unable to reach the POS terminal."}`,
        );
        setStage("error");
        return;
      }


      // Housekeeping conditions (no paper E006, low battery E011, printer
      // faults) are NOT card declines — never present them as a refused
      // payment. The donation session simply ends with a service message.
      if (isHousekeepingCode(result.errorCode)) {
        setErrorMessage(
          `يرجى إبلاغ الموظف المسؤول — الجهاز يحتاج إلى صيانة بسيطة.\n${
            conditionText(result.errorCode) ?? "Terminal needs attention (housekeeping)."
          }`,
        );
        setStage("error");
        return;
      }

      // The terminal refused the card (insufficient funds, expired card, ...).
      // Record the failed attempt so no receipt/billing is generated.
      void recordTransaction(result).catch(() => undefined);
      const detail = [result.responseText, result.responseCode ? `Code: ${result.responseCode}` : null]
        .filter(Boolean)
        .join(" · ");
      setDeclineMessage(detail);
      setStage("declined");
    } catch (err) {
      if (cancellingRef.current) return;
      void NboEcr.cancel().catch(() => undefined);
      setErrorMessage(err instanceof Error ? err.message : "Could not reach the payment terminal.");
      setStage("error");
    } finally {
      setPosTransactionActive(false);
    }


  }, [amount, category, categoryReference, kioskId, navigate, recordTransaction, transactionId]);

  useEffect(() => {
    void startPurchase();
  }, [startPurchase]);

  const cancelAtTerminal = useCallback(async () => {
    try {
      await NboEcr.cancel();
    } catch (err) {
      console.error("NBO terminal cancellation failed:", err);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (cancellingRef.current) return;
    cancellingRef.current = true;
    void cancelAtTerminal();
    navigate("/kiosk", { replace: true });
  }, [cancelAtTerminal, navigate]);

  // Declined payments auto-return to the categories page; the donor restarts
  // the donation from the beginning instead of retrying the same session.
  useEffect(() => {
    if (stage !== "declined" && stage !== "error") return;
    const timer = window.setTimeout(
      () => navigate("/kiosk", { replace: true }),
      stage === "declined" ? 2000 : 5000,
    );
    return () => window.clearTimeout(timer);
  }, [navigate, stage]);


  if (stage === "processing") {
    return (
      <TerminalTapScreen
        amount={amount}
        category={category}
        stage="waiting"
        onTimeout={handleCancel}
        timeoutSeconds={90}
      />
    );
  }

  if (stage === "error") {
    return (
      <KioskLayout>
        <div className="w-full max-w-xl mx-auto">
          <Card className="p-6 bg-white/50 backdrop-blur-xl shadow-lg border border-white/60 text-center rounded-xl">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-destructive">خطأ في جهاز الدفع</h2>
                <p className="text-sm text-destructive/70">Payment Terminal Error</p>
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{errorMessage}</p>
              </div>
            </div>
          </Card>
        </div>
      </KioskLayout>
    );
  }

  return (
    <KioskLayout>
      <div className="w-full max-w-md mx-auto flex flex-col justify-center pb-16">
        <Card className="px-5 py-8 bg-white/50 backdrop-blur-sm shadow-sm text-center rounded-xl">
          <div className="space-y-5">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full shadow-md flex items-center justify-center">
              <X className="w-9 h-9 text-destructive" aria-hidden="true" />
            </div>
            <div className="leading-tight flex flex-col items-center">
              <h2 className="text-2xl font-bold text-destructive tracking-normal">تم رفض العملية</h2>
              <p className="text-sm text-destructive/70 mt-1">Transaction Declined</p>
              {declineMessage && <p className="text-xs text-muted-foreground mt-2">{declineMessage}</p>}
            </div>
          </div>
        </Card>
      </div>
    </KioskLayout>
  );
};

export default NboPosPaymentPage;
