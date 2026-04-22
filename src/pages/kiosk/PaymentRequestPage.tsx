import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

const PaymentRequestPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');

  useEffect(() => {
    const checkPaymentMode = async () => {
      const kioskId = localStorage.getItem('kiosk_id');
      
      if (kioskId) {
        const { data: kioskData } = await supabase
          .from('kiosks')
          .select('configuration')
          .eq('id', kioskId)
          .single();
        
        const config = (kioskData?.configuration as any);
        const paymentMode = config?.payment_mode;

        if (paymentMode === 'test_payment') {
          navigate(`/kiosk/test-payment?category=${category}&amount=${amount}`);
          return;
        }
        
        if (paymentMode === 'payment_gateway') {
          // Route to Thawani Payment Gateway
          navigate(`/kiosk/thawani-gateway?category=${category}&amount=${amount}`);
          return;
        }
        
        if (paymentMode === 'soft_pos') {
          // Route to NFC payment page for Soft POS (Thawani Lamsa)
          navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
          return;
        }
      }
      
      // Default: go to Soft POS
      navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
    };
    
    checkPaymentMode();
  }, [navigate, category, amount]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto">
        <div className="space-y-4">
          <Card className="p-4 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
            <p className="text-base text-gray-600 mb-1">المبلغ المطلوب</p>
            <p className="text-xs text-gray-400 mb-1">Amount Required</p>
            <p className="text-3xl font-bold text-emerald-700 flex items-center justify-center gap-2">
              <CurrencyLogo className="h-6" />
              {formatAmount(amount)}
            </p>
          </Card>

          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl">💳</span></div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">جاري التحضير للدفع...</h2>
                <p className="text-sm text-gray-500">Preparing payment...</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PaymentRequestPage;
