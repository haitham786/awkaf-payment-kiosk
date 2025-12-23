import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const PaymentRequestPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [posType, setPosType] = useState<'hard_pos' | 'soft_pos'>('hard_pos');

  useEffect(() => {
    // Check POS type from kiosk configuration (per-kiosk setting)
    const checkPosType = async () => {
      const kioskId = localStorage.getItem('kiosk_id');
      
      if (kioskId) {
        // Read payment_mode from kiosk's own configuration
        const { data: kioskData } = await supabase
          .from('kiosks')
          .select('configuration')
          .eq('id', kioskId)
          .single();
        
        const paymentMode = (kioskData?.configuration as any)?.payment_mode;
        
        if (paymentMode === 'soft_pos') {
          // Route directly to NFC payment page for Soft POS (Thawani)
          navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
          return;
        }
      }
      
      // For Hard POS (default), continue to payment processing after 3 seconds
      const timer = setTimeout(() => {
        navigate(`/kiosk/payment-processing?category=${category}&amount=${amount}`);
      }, 3000);

      return () => clearTimeout(timer);
    };
    
    checkPosType();
  }, [navigate, category, amount]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto">
        <div className="space-y-4">
          {/* Amount Display */}
          <Card className="p-4 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
            <p className="text-base text-gray-600 mb-1">المبلغ المطلوب</p>
            <p className="text-3xl font-bold text-emerald-700">
              {formatAmount(amount)}
            </p>
          </Card>

          {/* POS Terminal Instructions */}
          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              {/* Animated Card on POS */}
              <div className="relative w-48 h-32 mx-auto">
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-20 bg-gradient-to-b from-gray-700 to-gray-900 rounded-lg shadow-lg">
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-20 h-12 bg-gray-800 rounded border-2 border-gray-600"></div>
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-emerald-500 rounded-full"></div>
                </div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-16 bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 rounded-lg shadow-xl animate-bounce border-2 border-yellow-300">
                  <div className="absolute top-2 right-2 w-8 h-6 bg-yellow-300/50 rounded"></div>
                  <div className="absolute bottom-2 left-2 right-2 h-1 bg-yellow-300/60 rounded"></div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-gray-900">
                  يرجى وضع البطاقة على جهاز نقاط البيع
                </h2>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex justify-center items-center gap-3 flex-wrap">
                  <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-4 object-contain" />
                  <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-4 object-contain" />
                  <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-4 object-contain" />
                  <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-4 object-contain" />
                  <img src="/images/payment-logos/gccnet.svg" alt="GCCNet" className="h-4 object-contain" />
                  <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-4 object-contain" />
                  <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-4 object-contain" />
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce ml-1"></div>
                <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce ml-1" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce ml-1" style={{ animationDelay: '0.2s' }}></div>
                <p className="text-gray-600 mr-3 text-sm">في انتظار البطاقة...</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PaymentRequestPage;
