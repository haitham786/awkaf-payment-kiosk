import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, FlaskConical } from "lucide-react";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { queueTransaction, isOnline } from "@/services/offlineQueueService";
import { toast } from "sonner";

const TestPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "donation";
  const amount = parseFloat(searchParams.get("amount") || "0");
  const kioskId = localStorage.getItem("kiosk_id") || "";
  const transactionId = useMemo(() => crypto.randomUUID(), []);
  const [categoryReference, setCategoryReference] = useState("");

  useEffect(() => {
    const loadCategory = async () => {
      const cached = sessionStorage.getItem(`category_${category}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCategoryReference(parsed?.category_reference || "");
        return;
      }

      const { data } = await supabase
        .from("donation_categories")
        .select("category_reference")
        .eq("category_id", category)
        .maybeSingle();

      setCategoryReference(data?.category_reference || "");
    };

    loadCategory();
  }, [category]);

  useEffect(() => {
    const completeTestPayment = async () => {
      if (!kioskId) {
        navigate("/kiosk/error");
        return;
      }

      const simulatedResult = {
        success: true,
        transactionId,
        responseCode: "00",
        responseMessage: "Approved",
        approvalCode: `TST${Math.floor(100000 + Math.random() * 900000)}`,
        cardType: "Test",
        cardLastFour: "4242",
        thawaniReference: `SIM-${Date.now()}`,
        isTest: true,
        timestamp: new Date().toISOString(),
      };

      const payload = {
        transactionId,
        kioskId,
        amount,
        category,
        mobileNumber: null,
        paymentType: "test_payment",
        provider: "simulator",
        softPosResult: simulatedResult,
        thawaniReference: simulatedResult.thawaniReference,
      };

      if (isOnline()) {
        try {
          const { data, error } = await supabase.functions.invoke("process-payment", { body: payload });
          if (error) throw error;

          navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data.transaction?.reference_number || transactionId}&transactionId=${transactionId}&paymentMethod=test_payment&catRef=${categoryReference}`);
          return;
        } catch (error) {
          console.error("Test payment processing failed:", error);
        }
      }

      queueTransaction({
        transactionId,
        kioskId,
        amount,
        category,
        paymentResult: simulatedResult,
        paymentType: "test_payment",
        provider: "simulator",
        createdAt: new Date().toISOString(),
      } as any);
      toast.info("Test payment saved. It will sync automatically.");
      navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&transactionId=${transactionId}&paymentMethod=test_payment&catRef=${categoryReference}`);
    };

    void completeTestPayment();
  }, [amount, category, categoryReference, kioskId, navigate, transactionId]);

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, "0")}`;
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-xl mx-auto space-y-4">
        <Card className="p-4 bg-accent/30 shadow-md border text-center">
          <p className="text-sm text-muted-foreground mb-0.5">المبلغ <span className="text-xs text-muted-foreground/70">Amount</span></p>
          <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <CurrencyLogo className="h-5" />
            {formatAmountNum(amount)}
          </p>
        </Card>

        <Card className="p-8 bg-card shadow-lg border text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/40 flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-primary" />
            </div>
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">جاري تسجيل عملية اختبار ناجحة...</h2>
              <p className="text-sm text-muted-foreground">Recording a successful test payment...</p>
            </div>
          </div>
        </Card>
      </div>
    </KioskLayout>
  );
};

export default TestPaymentPage;