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

        // Animate progress while waiting
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setTimeout(() => {
                if (data.success) {
                  navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data.transaction.transaction_ref}`);
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            جاري معالجة الدفع
          </h1>
          <p className="text-xl text-muted-foreground">
            يرجى الانتظار، لا تقم بإزالة البطاقة
          </p>
        </div>

        <div className="space-y-8">
          {/* Amount Display */}
          <Card className="p-6 bg-gradient-primary/10 backdrop-blur-sm shadow-card border-2 border-primary/40 text-center">
            <p className="text-lg text-muted-foreground mb-2">المبلغ</p>
            <p className="text-4xl font-bold text-primary">
              {formatAmount(amount)}
            </p>
          </Card>

          {/* Processing Animation */}
          <Card className="p-12 bg-card/90 backdrop-blur-sm shadow-elegant border border-primary/20 text-center">
            <div className="space-y-8">
              {/* Animated Circle */}
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"
                  style={{ 
                    background: `conic-gradient(from 0deg, hsl(var(--primary)) ${progress}%, transparent ${progress}%)`
                  }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl">💳</span>
                </div>
              </div>

              {/* Progress Text */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground">
                  معالجة العملية...
                </h2>
                
                <div className="space-y-2">
                  <div className="w-full bg-muted rounded-full h-3">
                    <div 
                      className="bg-gradient-primary h-3 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-lg font-semibold text-primary">
                    {Math.round(progress)}%
                  </p>
                </div>

                {/* Processing Steps */}
                <div className="space-y-3 text-lg">
                  <div className={`flex items-center justify-center space-x-4 ${progress > 20 ? 'text-success' : 'text-muted-foreground'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ml-3 ${progress > 20 ? 'bg-success text-success-foreground' : 'bg-muted'}`}>
                      {progress > 20 ? '✓' : '•'}
                    </span>
                    <p>التحقق من البطاقة</p>
                  </div>
                  
                  <div className={`flex items-center justify-center space-x-4 ${progress > 50 ? 'text-success' : 'text-muted-foreground'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ml-3 ${progress > 50 ? 'bg-success text-success-foreground' : 'bg-muted'}`}>
                      {progress > 50 ? '✓' : '•'}
                    </span>
                    <p>الاتصال بالبنك</p>
                  </div>
                  
                  <div className={`flex items-center justify-center space-x-4 ${progress > 80 ? 'text-success' : 'text-muted-foreground'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ml-3 ${progress > 80 ? 'bg-success text-success-foreground' : 'bg-muted'}`}>
                      {progress > 80 ? '✓' : '•'}
                    </span>
                    <p>تأكيد العملية</p>
                  </div>
                </div>
              </div>

              {/* Security Message */}
              <div className="bg-secondary/10 rounded-lg p-4 border border-secondary/30">
                <p className="text-sm text-foreground">
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