import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { loadKioskRuntimeConfig } from "@/lib/kioskConfig";

const PaymentRequestPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');

  useEffect(() => {
    const checkPaymentMode = async () => {
      const kioskId = localStorage.getItem('kiosk_id');
      
      try {
        if (kioskId) {
          const config = await loadKioskRuntimeConfig(kioskId);
          const paymentMode = config?.payment_mode;

          if (paymentMode === 'test_payment') {
            navigate(`/kiosk/test-payment?category=${category}&amount=${amount}`);
            return;
          }
          
          if (paymentMode === 'payment_gateway') {
            navigate(`/kiosk/thawani-gateway?category=${category}&amount=${amount}`);
            return;
          }
          
          if (paymentMode === 'soft_pos') {
            navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
            return;
          }
        }
      } catch (error) {
        console.error('PaymentRequestPage: Error loading config, defaulting to NFC', error);
      }
      
      // Default or fallback: go to Soft POS
      navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
    };
    
    checkPaymentMode();
  }, [navigate, category, amount]);

  // Keep kiosk background visible while we resolve the payment mode to avoid
  // a black/white flash between submission and the gateway screen.
  return <KioskLayout showHomeButton={false}>{null}</KioskLayout>;
};

export default PaymentRequestPage;
