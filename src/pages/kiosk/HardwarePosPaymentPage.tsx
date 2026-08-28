import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";
import { TerminalTapScreen } from "@/components/kiosk/TerminalTapScreen";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";
import { getCachedTerminalTimeout } from "@/lib/kioskConfig";
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
  const outcomeHandledRef = useRef(false);
  const categoryReferenceRef = useRef(categoryReference);
  categoryReferenceRef.current = categoryReference;

  // While an outcome is "unknown" the card may still have been charged, so we
  // keep the tap screen up and let the backend interrogate the terminal
  // instead of telling the donor it failed. Only after this window do we
  // surface the error.
  const RECOVERY_WINDOW_MS = 45000;
  const recoveryDeadlineRef = useRef<number>(Date.now() + RECOVERY_WINDOW_MS);
  const pendingUnknownRef = useRef<ApexResponse | null>(null);

  /** Single place where a terminal outcome moves the donor forward. */
  const applyOutcome = useCallback((result: ApexResponse, transactionId: string) => {
    if (outcomeHandledRef.current || cancellingRef.current || ignoreSaleResultRef.current) return;

    if (result.approved) {
      outcomeHandledRef.current = true;
      const ref = result.referenceNumber || result.rrn || transactionId;
      navigate(
        `/kiosk/thank-you?category=${category}&amount=${amount}&ref=${ref}` +
          `&transactionId=${transactionId}&paymentMethod=hardware_pos&catRef=${categoryReferenceRef.current}`,
      );
      return;
    }

    if (result.success === false && result.error) {
      // Unknown outcome (timeout, lost response, terminal still busy): keep
      // waiting so the recovery poll can find the real result at the terminal.
      if (result.outcomeUnknown && Date.now() < recoveryDeadlineRef.current) {
        pendingUnknownRef.current = result;
        setStage("processing");
        return;
      }

      outcomeHandledRef.current = true;
      const arabic = result.failureType === "afs_network_block"
        ? "تعذر على بوابة AFS الوصول إلى خدمة جهاز الدفع. يرجى التواصل مع AFS أو البنك الأهلي لتفعيل مسار الاتصال."
        : result.failureType === "terminal_cancelled"
          ? "تم إلغاء الطلب قبل قراءة البطاقة ولم يتم خصم أي مبلغ. يرجى المحاولة مرة أخرى."
          : result.failureType === "apex_rejected"
            ? "رفضت بوابة AFS إرسال الطلب إلى جهاز الدفع. يرجى التحقق من تفعيل وربط الجهاز مع AFS أو البنك الأهلي."
            : "تعذر الاتصال بجهاز الدفع. يرجى المحاولة لاحقاً.";
      const reference = result.correlationId ? `\nReference: ${result.correlationId}` : "";
      setRetryAllowed(true);
      setErrorMessage(`${arabic}\n${result.error}${reference}`);
      setStage("error");

      return;
    }

    // Declined by the card/issuer — the terminal has finished with this session.
    outcomeHandledRef.current = true;
    const detail = [result.responseText, result.responseCode ? `Code: ${result.responseCode}` : null]
      .filter(Boolean)
      .join(" · ");
    setDeclineMessage(detail);
    setStage("declined");
  }, [amount, category, navigate]);



  useEffect(() => {
    if (!kioskId) return;
    // Read the countdown from the device cache only. Fetching it here would
    // put a network round trip in front of the donor's SALE.
    const cached = getCachedTerminalTimeout(kioskId);
    if (cached) setTimeoutSeconds(cached + 5);
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
      applyOutcome((data || {}) as ApexResponse, transactionId);
    } catch (err) {
      if (cancellingRef.current || ignoreSaleResultRef.current || outcomeHandledRef.current) return;
      // The request itself failed, so the card may still have been charged.
      // Treat it as an unknown outcome and let the recovery poll decide.
      applyOutcome({
        success: false,
        approved: false,
        outcomeUnknown: true,
        failureType: "transport_error",
        error: err instanceof Error ? err.message : "Could not reach the payment terminal.",
      }, transactionId);
    }

  }, [amount, applyOutcome, category, kioskId]);

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

  // Outcome recovery: if the sale response is lost in transit (edge isolate
  // recycled, flaky link) the backend still knows — or can ask the terminal —
  // what happened. Poll so an approved payment always reaches the Thank-You
  // screen and is always recorded for billing.
  useEffect(() => {
    if (stage !== "processing" || !kioskId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || outcomeHandledRef.current || cancellingRef.current) return;
      const transactionId = transactionIdRef.current;
      try {
        const { data } = await supabase.functions.invoke("apex-ecr-payment", {
          body: { action: "outcome", kioskId, transactionId, amount, category },
        });
        if (cancelled || outcomeHandledRef.current || cancellingRef.current) return;
        const stored = (data as { finished?: boolean; result?: ApexResponse } | null)?.result;
        if (data?.finished && stored) {
          applyOutcome(stored, transactionId);
          return;
        }
      } catch {
        // Polling is best-effort; the direct sale response remains authoritative.
      }

      // The recovery window has closed without any terminal outcome — show the
      // last known failure so the donor is never left on a dead screen.
      if (!cancelled && !outcomeHandledRef.current && Date.now() >= recoveryDeadlineRef.current) {
        const pending = pendingUnknownRef.current;
        if (pending) {
          pendingUnknownRef.current = null;
          applyOutcome({ ...pending, outcomeUnknown: false }, transactionId);
        }
      }
    };

    const interval = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [amount, applyOutcome, category, kioskId, stage]);





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

  /**
   * Cancel leaves the payment screen as soon as the terminal acknowledges, or
   * after a short grace period if Apex is slow — the cancel request keeps
   * running in the background so the terminal prompt is always cleared.
   */
  const leaveAfterCancel = useCallback((graceMs = 4000) => {
    ignoreSaleResultRef.current = true;
    outcomeHandledRef.current = true;
    cancellingRef.current = true;
    setStage("cancelling");

    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      navigate("/kiosk");
    };
    const grace = window.setTimeout(leave, graceMs);
    void cancelAtTerminal().then(() => {
      window.clearTimeout(grace);
      leave();
    });
  }, [cancelAtTerminal, navigate]);

  const handleCancel = useCallback(() => {
    if (cancellingRef.current) return;
    leaveAfterCancel();
  }, [leaveAfterCancel]);

  const handleTimeout = () => {
    // Apex cancellation always targets the last request. Clear the terminal
    // prompt so the next donor is never met by an orphaned session.
    if (cancellingRef.current) return;
    leaveAfterCancel();
  };

  const handleTryAgain = () => {
    if (!retryAllowed) return;
    transactionIdRef.current = crypto.randomUUID();
    startedRef.current = false;
    ignoreSaleResultRef.current = false;
    outcomeHandledRef.current = false;
    pendingUnknownRef.current = null;
    recoveryDeadlineRef.current = Date.now() + RECOVERY_WINDOW_MS;
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
