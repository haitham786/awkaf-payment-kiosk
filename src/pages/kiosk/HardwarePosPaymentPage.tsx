import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";
import { TerminalTapScreen } from "@/components/kiosk/TerminalTapScreen";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";
import { loadKioskRuntimeConfig } from "@/lib/kioskConfig";
import { beginHardwarePosSale } from "@/lib/hardwarePosSale";
import { setHardwarePosSessionBusy } from "@/lib/hardwarePosWarm";


type Stage = "waiting" | "processing" | "cancelling" | "declined" | "error";

interface ApexResponse {
  success?: boolean;
  approved?: boolean;
  error?: string;
  referenceNumber?: string | null;
  rrn?: string | null;
  responseText?: string | null;
  responseCode?: string | null;
  timedOut?: boolean;
  correlationId?: string;
  failureType?: string;
  outcomeUnknown?: boolean;
}

interface CancellationResponse {
  success?: boolean;
  cancelled?: boolean;
  error?: string;
  state?: string;
}

const HardwarePosPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "donation";
  const amount = parseFloat(searchParams.get("amount") || "0");

  const [stage, setStage] = useState<Stage>("waiting");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryAllowed, setRetryAllowed] = useState(true);
  const [timeoutSeconds, setTimeoutSeconds] = useState(90);


  const [declineMessage, setDeclineMessage] = useState("");
  const [categoryReference, setCategoryReference] = useState<string>(
    () => readCachedCategory(category)?.category_reference || "",
  );

  // Every attempt gets its own transaction id so the terminal never sees a
  // repeated invoice number after a decline or a cancelled session.
  const transactionIdRef = useRef<string>(searchParams.get("transactionId") || crypto.randomUUID());
  const kioskId = localStorage.getItem("kiosk_id") || "";
  const startedRef = useRef(false);
  const cancellingRef = useRef(false);
  const ignoreSaleResultRef = useRef(false);

  useEffect(() => {
    if (!kioskId) return;
    void loadKioskRuntimeConfig(kioskId).then((config) => {
      const configuredTimeout = config?.hardware_pos?.timeout_seconds;
      if (typeof configuredTimeout === "number" && configuredTimeout >= 5) {
        setTimeoutSeconds(configuredTimeout + 5);
      }
    }).catch((error) => console.error("Unable to load terminal timeout:", error));
  }, [kioskId]);

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
    fetchCategory();
  }, [category]);

  const startSale = useCallback(async () => {
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

    const transactionId = transactionIdRef.current;
    try {
      const { data, error } = await beginHardwarePosSale({ kioskId, transactionId, amount, category });
      if (cancellingRef.current || ignoreSaleResultRef.current) return;
      if (error) throw error;

      const result = (data || {}) as ApexResponse;

      if (result.approved) {
        const ref = result.referenceNumber || result.rrn || transactionId;
        navigate(
          `/kiosk/thank-you?category=${category}&amount=${amount}&ref=${ref}` +
            `&transactionId=${transactionId}&paymentMethod=hardware_pos&catRef=${categoryReference}`,
        );
        return;
      }

      if (result.success === false && result.error) {
        const arabic = result.failureType === "afs_network_block"
          ? "تعذر على بوابة AFS الوصول إلى خدمة جهاز الدفع. يرجى التواصل مع AFS أو البنك الأهلي لتفعيل مسار الاتصال."
          : result.failureType === "apex_rejected"
            ? "رفضت بوابة AFS إرسال الطلب إلى جهاز الدفع. يرجى التحقق من تفعيل وربط الجهاز مع AFS أو البنك الأهلي."
            : "تعذر الاتصال بجهاز الدفع. يرجى المحاولة لاحقاً.";
        const reference = result.correlationId ? `\nReference: ${result.correlationId}` : "";
        setRetryAllowed(result.outcomeUnknown !== true);
        setErrorMessage(`${arabic}\n${result.error}${reference}`);
        setStage("error");
        return;
      }

      // Declined by the card/issuer — the terminal has finished with this session.
      const detail = [result.responseText, result.responseCode ? `Code: ${result.responseCode}` : null]
        .filter(Boolean)
        .join(" · ");
      setDeclineMessage(detail);
      setStage("declined");
    } catch (err) {
      if (cancellingRef.current || ignoreSaleResultRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : "Could not reach the payment terminal.");
      setStage("error");
    }
  }, [amount, category, categoryReference, kioskId, navigate]);

  useEffect(() => {
    // The idle readiness loop must never probe while a donor is paying.
    setHardwarePosSessionBusy(true);
    return () => setHardwarePosSessionBusy(false);
  }, []);

  useEffect(() => {
    // Send the SALE immediately — the tap prompt renders in the same frame.
    setStage("processing");
    void startSale();
  }, [startSale]);

  useEffect(() => {
    // Backend dispatch is normally ~150-250 ms. Anything past this threshold is
    // terminal/bank-network transit, so it is surfaced instead of a silent wait.
    if (stage !== "processing") {
      setSlowDispatch(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowDispatch(true), 6000);
    return () => window.clearTimeout(timer);
  }, [stage]);



  const cancelAtTerminal = useCallback(async () => {
    if (!kioskId) return false;
    try {
      const { data, error } = await supabase.functions.invoke("apex-ecr-payment", {
        body: { action: "cancel", kioskId, transactionId: transactionIdRef.current },
      });
      if (error) throw error;
      const result = (data || {}) as CancellationResponse;
      const safeToLeave = result.cancelled === true || (
        result.success === true && ["approved", "declined", "failed", "cancelled"].includes(result.state || "")
      );
      if (!safeToLeave && result.error) console.error("Terminal rejected cancellation:", result.error);
      return safeToLeave;
    } catch (err) {
      console.error("Terminal cancellation failed:", err);
      return false;
    }
  }, [kioskId]);

  const handleCancel = useCallback(async () => {
    if (cancellingRef.current) return;
    cancellingRef.current = true;
    setStage("cancelling");

    // Always push the cancellation to the terminal so the amount clears from
    // its screen. The request keeps running in the background if it is slow —
    // the donor is never held on the kiosk for more than a few seconds.
    const cancelled = await cancelAtTerminal();
    if (cancelled) {
      ignoreSaleResultRef.current = true;
      navigate("/kiosk");
      return;
    }
    cancellingRef.current = false;
    setRetryAllowed(false);
    setErrorMessage("لم يؤكد جهاز الدفع الإلغاء. يرجى الانتظار حتى يعود الجهاز إلى شاشة الاستعداد.\nThe terminal did not confirm cancellation. Please wait until it returns to the idle screen.");
    setStage("error");
  }, [cancelAtTerminal, navigate]);


  const handleTimeout = () => {
    // Apex cancellation always targets the last request. Clear the terminal
    // prompt before exposing the timeout state so the next donor is never met
    // by an orphaned session or "Another transaction under processing".
    ignoreSaleResultRef.current = true;
    cancellingRef.current = true;
    setStage("cancelling");
    void cancelAtTerminal().then((cancelled) => {
      if (cancelled) {
        navigate("/kiosk");
        return;
      }
      cancellingRef.current = false;
      setRetryAllowed(false);
      setErrorMessage("انتهت المهلة ولم يؤكد جهاز الدفع الإلغاء. يرجى الانتظار حتى يعود الجهاز إلى شاشة الاستعداد.\nThe session timed out and the terminal did not confirm cancellation. Please wait until it returns to idle.");
      setStage("error");
    });
  };

  const handleTryAgain = () => {
    if (!retryAllowed) return;
    transactionIdRef.current = crypto.randomUUID();
    startedRef.current = false;
    ignoreSaleResultRef.current = false;
    setErrorMessage("");
    setDeclineMessage("");
    setStage("processing");
    void startSale();
  };

  useEffect(() => {
    if (stage !== "declined" && !(stage === "error" && retryAllowed)) return;
    const timer = window.setTimeout(() => navigate("/kiosk"), 10000);
    return () => window.clearTimeout(timer);
  }, [navigate, retryAllowed, stage]);

  if (stage === "waiting" || stage === "processing" || stage === "cancelling") {
    return (
      <TerminalTapScreen
        amount={amount}
        category={category}
        stage={stage === "cancelling" ? "processing" : stage}
        onCancel={handleCancel}
        onTimeout={handleTimeout}
        timeoutSeconds={timeoutSeconds}
        cancelling={stage === "cancelling"}
        slowDispatch={slowDispatch}

      />
    );
  }

  if (stage === "error") {
    return (
      <KioskLayout showHomeButton={false}>
        <div className="w-full max-w-xl mx-auto space-y-3">
          <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-700">خطأ في جهاز الدفع</h2>
                <p className="text-sm text-red-500">Payment Terminal Error</p>
                <p className="text-xs text-gray-600 mt-2 whitespace-pre-line">{errorMessage}</p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                {retryAllowed && (
                  <KioskButton variant="confirm" size="sm" onClick={handleTryAgain}>
                    <span className="flex flex-col items-center">
                      <span>حاول مرة أخرى</span>
                      <span className="text-[0.6rem] opacity-80">Try Again</span>
                    </span>
                  </KioskButton>
                )}
                <KioskButton variant="secondary" size="sm" onClick={handleCancel}>
                  <span className="flex flex-col items-center">
                    <span>إلغاء</span>
                    <span className="text-[0.6rem] opacity-80">Cancel</span>
                  </span>
                </KioskButton>
              </div>
            </div>
          </Card>
        </div>
      </KioskLayout>
    );
  }

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-md mx-auto flex flex-col justify-center gap-3 pb-24">
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

        <div className="grid grid-cols-2 gap-4 px-1 pt-2 items-stretch">
          <KioskButton
            variant="secondary"
            size="xl"
            onClick={handleCancel}
            className="h-auto min-h-[82px] px-8 py-5 bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 rounded-xl shadow-sm flex items-center justify-center"
          >
            <span className="flex flex-col items-center leading-tight">
              <span className="text-base font-bold text-gray-900 tracking-normal">إلغاء</span>
              <span className="text-xs font-normal text-gray-900 mt-1">Cancel</span>
            </span>
          </KioskButton>
          <KioskButton
            variant="secondary"
            size="xl"
            onClick={handleTryAgain}
            className="h-auto min-h-[82px] px-8 py-5 bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 rounded-xl shadow-sm flex items-center justify-center"
          >
            <span className="flex flex-col items-center leading-tight">
              <span className="text-base font-bold text-gray-900 tracking-normal">المحاولة مرة أخرى</span>
              <span className="text-xs font-normal text-gray-900 mt-1">Try Again</span>
            </span>
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default HardwarePosPaymentPage;
