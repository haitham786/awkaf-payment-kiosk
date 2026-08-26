import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";
import { TerminalTapScreen } from "@/components/kiosk/TerminalTapScreen";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";

type Stage = "waiting" | "processing" | "declined" | "error";

interface ApexResponse {
  success?: boolean;
  approved?: boolean;
  error?: string;
  referenceNumber?: string | null;
  rrn?: string | null;
  responseText?: string | null;
  timedOut?: boolean;
  correlationId?: string;
  failureType?: string;
  outcomeUnknown?: boolean;
}

const HardwarePosPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "donation";
  const amount = parseFloat(searchParams.get("amount") || "0");

  const [stage, setStage] = useState<Stage>("waiting");
  const [errorMessage, setErrorMessage] = useState("");
  const [categoryReference, setCategoryReference] = useState<string>(
    () => readCachedCategory(category)?.category_reference || "",
  );

  const transactionId = React.useMemo(() => crypto.randomUUID(), []);
  const kioskId = localStorage.getItem("kiosk_id") || "";
  const startedRef = useRef(false);

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

    try {
      const { data, error } = await supabase.functions.invoke("apex-ecr-payment", {
        body: { action: "sale", kioskId, transactionId, amount, category },
      });
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
          : "تعذر الاتصال بجهاز الدفع. يرجى المحاولة لاحقاً.";
        const reference = result.correlationId ? `\nReference: ${result.correlationId}` : "";
        setErrorMessage(`${arabic}\n${result.error}${reference}`);
        setStage("error");
        return;
      }

      setStage("declined");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not reach the payment terminal.");
      setStage("error");
    }
  }, [amount, category, categoryReference, kioskId, navigate, transactionId]);

  useEffect(() => {
    // Show the tap prompt for a beat, then send the SALE to the terminal.
    setStage("waiting");
    const t = window.setTimeout(() => {
      setStage("processing");
      void startSale();
    }, 300);
    return () => window.clearTimeout(t);
  }, [startSale]);

  const cancelAtTerminal = useCallback(() => {
    if (!kioskId) return;
    void supabase.functions.invoke("apex-ecr-payment", {
      body: { action: "cancel", kioskId },
    });
  }, [kioskId]);

  const handleCancel = () => {
    cancelAtTerminal();
    navigate("/kiosk");
  };

  const handleTimeout = () => {
    setErrorMessage("انتهت مهلة الاتصال بجهاز الدفع. لا تحاول الدفع مرة أخرى حتى يتم التأكد من نتيجة العملية.\nThe terminal response timed out. Please verify the transaction outcome before retrying.");
    setStage("error");
  };

  const handleTryAgain = () => {
    startedRef.current = false;
    setErrorMessage("");
    setStage("waiting");
    window.setTimeout(() => {
      setStage("processing");
      void startSale();
    }, 200);
  };

  useEffect(() => {
    if (stage !== "declined" && stage !== "error") return;
    const timer = window.setTimeout(() => navigate("/kiosk"), 10000);
    return () => window.clearTimeout(timer);
  }, [navigate, stage]);

  if (stage === "waiting" || stage === "processing") {
    return (
      <TerminalTapScreen
        amount={amount}
        category={category}
        stage={stage}
        onCancel={handleCancel}
        onTimeout={handleTimeout}
      />
    );
  }

  if (stage === "error") {
    return (
      <KioskLayout>
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
                <KioskButton variant="confirm" size="sm" onClick={handleTryAgain}>
                  <span className="flex flex-col items-center">
                    <span>حاول مرة أخرى</span>
                    <span className="text-[0.6rem] opacity-80">Try Again</span>
                  </span>
                </KioskButton>
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
    <KioskLayout>
      <div className="w-full max-w-md mx-auto flex flex-col justify-center gap-3 pb-24">
        <Card className="px-5 py-8 bg-white/50 backdrop-blur-sm shadow-sm text-center rounded-xl">
          <div className="space-y-5">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full shadow-md flex items-center justify-center">
              <X className="w-9 h-9 text-destructive" aria-hidden="true" />
            </div>
            <div className="leading-tight flex flex-col items-center">
              <h2 className="text-2xl font-bold text-destructive tracking-normal">تم رفض العملية</h2>
              <p className="text-sm text-destructive/70 mt-1">Transaction Declined</p>
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
