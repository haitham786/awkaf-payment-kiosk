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
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            طلب الدفع
          </h1>
          <p className="text-base text-gray-600">
            يرجى استخدام البطاقة البنكية للدفع
          </p>
        </div>

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
              {/* POS Terminal Image Placeholder */}
              <div className="w-36 h-24 mx-auto bg-gray-100 rounded-lg shadow-md border-2 border-gray-300 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl mb-1">💳</div>
                  <p className="text-xs font-medium text-gray-700">جهاز نقاط البيع</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-gray-900">
                  يرجى اتباع التعليمات التالية:
                </h2>
                
                <div className="space-y-2 text-base">
                  <div className="flex items-center justify-center space-x-3">
                    <span className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm ml-2">١</span>
                    <p className="text-gray-800">أدخل البطاقة في الجهاز</p>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-3">
                    <span className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm ml-2">٢</span>
                    <p className="text-gray-800">أو مرر البطاقة على الجهاز</p>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-3">
                    <span className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm ml-2">٣</span>
                    <p className="text-gray-800">أو قرب البطاقة من الجهاز (الدفع اللاتلامسي)</p>
                  </div>
                </div>
              </div>

              {/* Supported Cards */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-semibold mb-2 text-gray-900">البطاقات المدعومة:</p>
                <div className="flex justify-center items-center gap-2 flex-wrap">
                  <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-5" />
                  <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-5" />
                  <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-5" />
                  <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-5" />
                  <img src="/images/payment-logos/gccnet.svg" alt="GCCNet" className="h-5" />
                  <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-5" />
                  <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-5" />
                </div>
              </div>

              {/* Waiting Animation */}
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
