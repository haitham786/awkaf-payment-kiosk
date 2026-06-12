import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { loadKioskRuntimeConfig } from "@/lib/kioskConfig";
import { Loader2 } from "lucide-react";

const PaymentRequestPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');

  useEffect(() => {
    const checkPaymentMode = async () => {
      const kioskId = localStorage.getItem('kiosk_id');
      const softPosUrl = `/kiosk/nfc-payment?category=${category}&amount=${amount}`;
      
      try {
        if (kioskId) {
          const config = await Promise.race([
            loadKioskRuntimeConfig(kioskId),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500)),
          ]);
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
            navigate(softPosUrl);
            return;
          }
        }
      } catch (error) {
        console.error('PaymentRequestPage: Error loading config, defaulting to NFC', error);
      }
      
      // Default or fallback: Soft POS must never be blocked by config lookup failure.
      navigate(softPosUrl);
    };
    
    checkPaymentMode();
  }, [navigate, category, amount]);

  return (
    <KioskLayout showHomeButton={false}>
      <div className="flex flex-col items-center justify-center gap-3 text-gray-900">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        <div className="text-center leading-tight">
          <p className="text-lg font-bold">جاري فتح الدفع</p>
          <p className="text-sm text-gray-600">Opening payment</p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PaymentRequestPage;
