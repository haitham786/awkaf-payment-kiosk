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

  // Don't render any loading UI — keep the previous screen visible until we navigate
  // to the next page (Thawani gateway, Soft POS, or test payment).
  return null;
};

export default PaymentRequestPage;
