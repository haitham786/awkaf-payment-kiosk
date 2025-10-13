import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const PaymentProcessingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Generate transaction ID
        const transactionId = crypto.randomUUID();
        const kioskId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"; // Default kiosk ID

        // Call edge function to process payment
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            transactionId,
            kioskId,
            amount,
            category,
            mobileNumber: searchParams.get('mobile') || null,
          },
        });

        if (error) throw error;

        // Fetch category reference
        const { data: categoryData } = await supabase
          .from('donation_categories')
          .select('category_reference')
          .eq('category_id', category)
          .maybeSingle();

        // Animate progress while waiting
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setTimeout(() => {
                if (data.success) {
                  navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data.transaction.reference_number}&catRef=${categoryData?.category_reference || ''}`);
                } else {
                  navigate(`/kiosk/error?category=${category}&amount=${amount}`);
                }
              }, 500);
              return 100;
            }
            return prev + 2;
          });
        }, 100);
      } catch (error) {
        console.error('Payment error:', error);
        navigate(`/kiosk/error?category=${category}&amount=${amount}`);
      }
    };

    processPayment();
  }, [navigate, category, amount, searchParams]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            جاري معالجة الدفع
          </h1>
          <p className="text-base text-gray-600">
            يرجى الانتظار، لا تقم بإزالة البطاقة
          </p>
        </div>

        <div className="space-y-4">
          {/* Amount Display */}
          <Card className="p-4 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
            <p className="text-base text-gray-600 mb-1">المبلغ</p>
            <p className="text-3xl font-bold text-emerald-700">
              {formatAmount(amount)}
            </p>
          </Card>

          {/* Processing Animation */}
          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              {/* Animated Circle */}
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin"
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">💳</span>
                </div>
              </div>

              {/* Progress Text */}
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-gray-900">
                  معالجة العملية...
                </h2>
                
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-base font-semibold text-emerald-700">
                    {Math.round(progress)}%
                  </p>
                </div>

                {/* Processing Steps */}
                <div className="space-y-2 text-base">
                  <div className={`flex items-center justify-center space-x-3 ${progress > 20 ? 'text-emerald-700' : 'text-gray-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ml-2 ${progress > 20 ? 'bg-emerald-600 text-white' : 'bg-gray-300'}`}>
                      {progress > 20 ? '✓' : '•'}
                    </span>
                    <p>التحقق من البطاقة</p>
                  </div>
                  
                  <div className={`flex items-center justify-center space-x-3 ${progress > 50 ? 'text-emerald-700' : 'text-gray-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ml-2 ${progress > 50 ? 'bg-emerald-600 text-white' : 'bg-gray-300'}`}>
                      {progress > 50 ? '✓' : '•'}
                    </span>
                    <p>الاتصال بالبنك</p>
                  </div>
                  
                  <div className={`flex items-center justify-center space-x-3 ${progress > 80 ? 'text-emerald-700' : 'text-gray-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ml-2 ${progress > 80 ? 'bg-emerald-600 text-white' : 'bg-gray-300'}`}>
                      {progress > 80 ? '✓' : '•'}
                    </span>
                    <p>تأكيد العملية</p>
                  </div>
                </div>
              </div>

              {/* Security Message */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm text-gray-800">
                  🔒 جميع المعاملات مؤمنة ومشفرة
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PaymentProcessingPage;
