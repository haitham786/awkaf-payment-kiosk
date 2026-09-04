import React, { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { queueTransaction, isOnline } from "@/services/offlineQueueService";
import { readCachedCategory } from "@/lib/kioskCategoryCache";

const TestPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "donation";
  const amount = parseFloat(searchParams.get("amount") || "0");
  const kioskId = localStorage.getItem("kiosk_id") || "";
  const transactionId = useMemo(() => crypto.randomUUID(), []);
  const categoryReference = readCachedCategory(category)?.category_reference || "";

  useEffect(() => {
    const completeTestPayment = async () => {
      if (!kioskId) {
        navigate("/kiosk/error");
        return;
      }

      // Open the success screen immediately; recording continues in the
      // background so Test Mode never shows an intermediate progress page.
      navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&transactionId=${transactionId}&paymentMethod=test_payment&catRef=${categoryReference}`, { replace: true });

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
          const { error } = await supabase.functions.invoke("process-payment", { body: payload });
          if (error) throw error;

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
    };

    void completeTestPayment();
  }, [amount, category, categoryReference, kioskId, navigate, transactionId]);

  return null;
};

export default TestPaymentPage;