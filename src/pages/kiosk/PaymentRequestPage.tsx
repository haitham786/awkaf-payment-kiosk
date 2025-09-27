import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";

const PaymentRequestPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');

  useEffect(() => {
    // Simulate payment processing after 3 seconds
    const timer = setTimeout(() => {
      navigate(`/kiosk/payment-processing?category=${category}&amount=${amount}`);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, category, amount]);

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
            طلب الدفع
          </h1>
          <p className="text-xl text-muted-foreground">
            يرجى استخدام البطاقة البنكية للدفع
          </p>
        </div>

        <div className="space-y-8">
          {/* Amount Display */}
          <Card className="p-6 bg-gradient-primary/10 backdrop-blur-sm shadow-card border-2 border-primary/40 text-center">
            <p className="text-lg text-muted-foreground mb-2">المبلغ المطلوب</p>
            <p className="text-4xl font-bold text-primary">
              {formatAmount(amount)}
            </p>
          </Card>

          {/* POS Terminal Instructions */}
          <Card className="p-12 bg-card/90 backdrop-blur-sm shadow-elegant border border-primary/20 text-center">
            <div className="space-y-8">
              {/* POS Terminal Image Placeholder */}
              <div className="w-48 h-32 mx-auto bg-gradient-card rounded-lg shadow-card border-2 border-primary/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">💳</div>
                  <p className="text-sm font-medium">جهاز نقاط البيع</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground">
                  يرجى اتباع التعليمات التالية:
                </h2>
                
                <div className="space-y-3 text-lg">
                  <div className="flex items-center justify-center space-x-4">
                    <span className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold ml-3">١</span>
                    <p>أدخل البطاقة في الجهاز</p>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-4">
                    <span className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold ml-3">٢</span>
                    <p>أو مرر البطاقة على الجهاز</p>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-4">
                    <span className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold ml-3">٣</span>
                    <p>أو قرب البطاقة من الجهاز (الدفع اللاتلامسي)</p>
                  </div>
                </div>
              </div>

              {/* Supported Cards */}
              <div className="bg-gradient-card rounded-lg p-6 border border-primary/20">
                <p className="text-lg font-semibold mb-4">البطاقات المدعومة:</p>
                <div className="flex justify-center space-x-4 flex-wrap">
                  <span className="bg-primary/10 px-4 py-2 rounded-lg text-sm font-medium mx-1 mb-2">Visa</span>
                  <span className="bg-primary/10 px-4 py-2 rounded-lg text-sm font-medium mx-1 mb-2">MasterCard</span>
                  <span className="bg-primary/10 px-4 py-2 rounded-lg text-sm font-medium mx-1 mb-2">مدى</span>
                  <span className="bg-primary/10 px-4 py-2 rounded-lg text-sm font-medium mx-1 mb-2">Apple Pay</span>
                  <span className="bg-primary/10 px-4 py-2 rounded-lg text-sm font-medium mx-1 mb-2">Google Pay</span>
                </div>
              </div>

              {/* Waiting Animation */}
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce ml-1"></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce ml-1" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce ml-1" style={{ animationDelay: '0.2s' }}></div>
                <p className="text-muted-foreground mr-4">في انتظار البطاقة...</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PaymentRequestPage;