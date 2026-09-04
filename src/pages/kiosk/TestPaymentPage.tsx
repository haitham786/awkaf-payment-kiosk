import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { supabase } from "@/integrations/supabase/client";
import { queueTransaction, isOnline } from "@/services/offlineQueueService";
import { toast } from "sonner";
import { readCachedCategory } from "@/lib/kioskCategoryCache";

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
      const cached = readCachedCategory(category);
      if (cached) {
        const parsed = cached;
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

  return <KioskLayout showHomeButton={false}>{null}</KioskLayout>;
};

export default TestPaymentPage;