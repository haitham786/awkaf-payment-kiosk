import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";

const ThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const transactionId = searchParams.get('transactionId') || '';
  const referenceNumber = searchParams.get('ref') || '';
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/kiosk');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
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
      <div className="w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          {/* Organization Logo Placeholder */}
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full shadow-lg flex items-center justify-center">
            <span className="text-3xl">🕌</span>
          </div>
        </div>

        {/* Success Card */}
        <Card className="p-6 bg-white shadow-lg border-2 border-emerald-300 text-center">
          <div className="space-y-4">
            {/* Success Icon */}
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full shadow-md flex items-center justify-center">
              <span className="text-3xl">✅</span>
            </div>

            {/* Thank You Message */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-emerald-700">
                شكراً لكم!
              </h1>
              <h2 className="text-xl font-semibold text-gray-900">
                تم قبول تبرعكم بنجاح
              </h2>
            </div>

            {/* Donation Summary */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-gray-600 mb-1 text-sm">المبلغ المتبرع به</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatAmount(amount)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1 text-sm">نوع التبرع</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {category === 'zakat' && 'زكاة'}
                    {category === 'sadaqah' && 'صدقة'}
                    {category === 'charity' && 'خيرية'}
                    {category === 'mosque' && 'مسجد'}
                    {category === 'orphans' && 'أيتام'}
                    {category === 'education' && 'تعليم'}
                  </p>
                </div>
              </div>
            </div>

            {/* Islamic Quote */}
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <p className="text-lg font-medium text-gray-800 leading-relaxed">
                "جَزَاكُمُ اللهُ خَيْرًا"
              </p>
              <p className="text-base text-gray-600 mt-1">
                بارك الله فيكم وجعله في ميزان حسناتكم
              </p>
            </div>

            {/* Transaction Reference Number */}
            <div className="bg-gray-100 rounded-lg p-3 border border-gray-300">
              <p className="text-sm text-gray-600">رقم المعاملة</p>
              <p className="text-base font-mono font-semibold text-gray-900">
                {referenceNumber || transactionId}
              </p>
            </div>
          </div>
        </Card>

        {/* Receipt Options */}
        <div className="mt-4 space-y-3">
          <Card className="p-4 bg-white shadow-md border border-gray-300">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                هل تريد إيصال عبر الرسائل النصية؟
              </h3>
              
              <div className="flex justify-center space-x-3">
                <KioskButton
                  variant="secondary"
                  size="xl"
                  onClick={handleSMSReceipt}
                  className="min-w-[160px] ml-3 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                >
                  نعم، أرسل الإيصال
                </KioskButton>
                
                <KioskButton
                  variant="outline"
                  size="xl"
                  onClick={handleReturnHome}
                  className="min-w-[160px] bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-900"
                >
                  لا، شكراً
                </KioskButton>
              </div>
            </div>
          </Card>

          {/* Auto Return Countdown */}
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              العودة التلقائية إلى الصفحة الرئيسية خلال {countdown} ثواني
            </p>
            <div className="w-32 h-2 bg-gray-200 rounded-full mx-auto mt-2">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${((10 - countdown) / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ThankYouPage;
