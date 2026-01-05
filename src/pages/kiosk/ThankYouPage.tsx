import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";

const ThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const transactionId = searchParams.get('transactionId') || '';
  const referenceNumber = searchParams.get('ref') || '';

  // Silent countdown - no display but still redirects
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/kiosk');
    }, 10000);
    return () => clearTimeout(timer);
  }, [navigate]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  const handleSMSReceipt = () => {
    navigate(`/kiosk/mobile-number?category=${category}&amount=${amount}&ref=${referenceNumber}&transactionId=${transactionId}`);
  };

  const handleReturnHome = () => {
    navigate('/kiosk');
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto flex flex-col min-h-[calc(100vh-120px)] justify-between">
        <div>
          {/* Thank You Message */}
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">
              شكراً لكم
            </h1>
            <h2 className="text-xl font-semibold text-white/90 mt-2">
              تم قبول تبرعكم بنجاح
            </h2>
          </div>

          {/* Donation Summary Card */}
          <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-lg border-0 text-center">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-600 mb-1 text-sm">المبلغ المتبرع به</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatAmount(amount)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-600 mb-1 text-sm">نوع التبرع</p>
                <p className="text-xl font-semibold text-gray-900">
                  {category === 'zakat' && 'زكاة'}
                  {category === 'sadaqah' && 'صدقة'}
                  {category === 'charity' && 'خيرية'}
                  {category === 'mosque' && 'مسجد'}
                  {category === 'orphans' && 'أيتام'}
                  {category === 'education' && 'تعليم'}
                  {category === 'donation' && 'تبرع'}
                </p>
              </div>
            </div>
          </Card>

          {/* Receipt Option */}
          <Card className="mt-4 p-4 bg-white/90 backdrop-blur-sm shadow-lg border-0">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                هل تريد إيصال عبر الرسائل النصية؟
              </h3>
              
              <KioskButton
                variant="confirm"
                size="xl"
                soundEffect="navigation"
                onClick={handleSMSReceipt}
                className="w-full max-w-[200px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              >
                نعم
              </KioskButton>
            </div>
          </Card>
        </div>

        {/* Home Button at bottom center */}
        <div className="flex justify-center pb-6 mt-4">
          <KioskButton
            variant="outline"
            size="lg"
            soundEffect="navigation"
            onClick={handleReturnHome}
            className="bg-white/80 backdrop-blur-sm border-0 hover:bg-white text-gray-900 px-8"
          >
            <Home className="w-5 h-5 ml-2" />
            الصفحة الرئيسية
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ThankYouPage;
