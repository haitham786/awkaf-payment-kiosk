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
  const [countdown, setCountdown] = useState(5);

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
    navigate(`/kiosk/mobile-number?category=${category}&amount=${amount}`);
  };

  const handleReturnHome = () => {
    navigate('/kiosk');
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Organization Logo Placeholder */}
          <div className="w-32 h-32 mx-auto mb-6 bg-gradient-primary rounded-full shadow-elegant flex items-center justify-center animate-glow">
            <span className="text-4xl text-primary-foreground">🕌</span>
          </div>
        </div>

        {/* Success Card */}
        <Card className="p-12 bg-card/90 backdrop-blur-sm shadow-elegant border-2 border-success/30 text-center">
          <div className="space-y-8">
            {/* Success Icon */}
            <div className="w-24 h-24 mx-auto bg-gradient-to-r from-success to-success/80 rounded-full shadow-elegant flex items-center justify-center animate-bounce">
              <span className="text-4xl">✅</span>
            </div>

            {/* Thank You Message */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-success">
                شكراً لكم!
              </h1>
              <h2 className="text-2xl font-semibold text-foreground">
                تم قبول تبرعكم بنجاح
              </h2>
            </div>

            {/* Donation Summary */}
            <div className="bg-gradient-card rounded-lg p-6 border border-primary/20">
              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <p className="text-muted-foreground mb-2">المبلغ المتبرع به</p>
                  <p className="text-3xl font-bold text-primary">
                    {formatAmount(amount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2">نوع التبرع</p>
                  <p className="text-2xl font-semibold text-secondary">
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
            <div className="bg-gradient-gold/10 rounded-lg p-6 border border-secondary/30">
              <p className="text-xl font-medium text-foreground leading-relaxed">
                "جَزَاكُمُ اللهُ خَيْرًا"
              </p>
              <p className="text-lg text-muted-foreground mt-2">
                بارك الله فيكم وجعله في ميزان حسناتكم
              </p>
            </div>

            {/* Transaction ID */}
            <div className="bg-muted/50 rounded-lg p-4 border border-muted">
              <p className="text-sm text-muted-foreground">رقم العملية</p>
              <p className="text-lg font-mono font-semibold text-foreground">
                #{Math.random().toString(36).substr(2, 9).toUpperCase()}
              </p>
            </div>
          </div>
        </Card>

        {/* Receipt Options */}
        <div className="mt-8 space-y-4">
          <Card className="p-6 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold text-foreground">
                هل تريد إيصال عبر الرسائل النصية؟
              </h3>
              
              <div className="flex justify-center space-x-4">
                <KioskButton
                  variant="secondary"
                  size="xl"
                  onClick={handleSMSReceipt}
                  className="min-w-[200px] ml-4"
                >
                  نعم، أرسل الإيصال
                </KioskButton>
                
                <KioskButton
                  variant="outline"
                  size="xl"
                  onClick={handleReturnHome}
                  className="min-w-[200px]"
                >
                  لا، شكراً
                </KioskButton>
              </div>
            </div>
          </Card>

          {/* Auto Return Countdown */}
          <div className="text-center">
            <p className="text-muted-foreground">
              العودة التلقائية إلى الصفحة الرئيسية خلال {countdown} ثواني
            </p>
            <div className="w-32 h-2 bg-muted rounded-full mx-auto mt-2">
              <div 
                className="h-full bg-gradient-primary rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ThankYouPage;