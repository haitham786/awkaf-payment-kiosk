import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

const ErrorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  
  // Get error type from URL params or default to payment
  const errorType = searchParams.get('error') || 'payment';

  const getErrorMessage = () => {
    switch (errorType) {
      case 'network':
        return {
          title: "خطأ في الاتصال",
          description: "تعذر الاتصال بالشبكة، يرجى المحاولة مرة أخرى",
          icon: "🌐"
        };
      case 'card':
        return {
          title: "خطأ في البطاقة",
          description: "تعذر قراءة البطاقة، يرجى التأكد من البطاقة والمحاولة مرة أخرى",
          icon: "💳"
        };
      case 'insufficient':
        return {
          title: "رصيد غير كافٍ",
          description: "الرصيد في البطاقة غير كافٍ لإتمام العملية",
          icon: "💰"
        };
      case 'declined':
        return {
          title: "تم رفض العملية",
          description: "تم رفض العملية من البنك، يرجى التواصل مع البنك",
          icon: "❌"
        };
      default:
        return {
          title: "خطأ في الدفع",
          description: "حدث خطأ أثناء معالجة الدفع، يرجى المحاولة مرة أخرى",
          icon: "⚠️"
        };
    }
  };

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  const handleTryAgain = () => {
    navigate(`/kiosk/amount?category=${category}`);
  };

  const handleCancel = () => {
    navigate('/kiosk');
  };

  const errorInfo = getErrorMessage();

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-destructive mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-xl text-muted-foreground">
            نعتذر عن هذا الإزعاج
          </p>
        </div>

        {/* Error Card */}
        <Card className="p-12 bg-card/90 backdrop-blur-sm shadow-elegant border-2 border-destructive/30 text-center">
          <div className="space-y-8">
            {/* Error Icon */}
            <div className="w-24 h-24 mx-auto bg-gradient-to-r from-destructive/20 to-destructive/10 rounded-full shadow-elegant flex items-center justify-center border-2 border-destructive/30">
              <span className="text-4xl">{errorInfo.icon}</span>
            </div>

            {/* Error Message */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-destructive">
                {errorInfo.title}
              </h2>
              <p className="text-lg text-foreground leading-relaxed">
                {errorInfo.description}
              </p>
            </div>

            {/* Transaction Details */}
            <div className="bg-gradient-card rounded-lg p-6 border border-primary/20">
              <h3 className="text-lg font-semibold mb-4 text-foreground">
                تفاصيل العملية المتأثرة:
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-muted-foreground mb-1">المبلغ</p>
                  <p className="text-xl font-bold text-primary">
                    {formatAmount(amount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground mb-1">نوع التبرع</p>
                  <p className="text-lg font-semibold text-secondary">
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

            {/* Troubleshooting Tips */}
            <div className="bg-secondary/10 rounded-lg p-6 border border-secondary/30 text-right">
              <h3 className="text-lg font-semibold mb-3 text-foreground">
                نصائح للحل:
              </h3>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-secondary rounded-full ml-3"></span>
                  تأكد من أن البطاقة مدخلة بالطريقة الصحيحة
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-secondary rounded-full ml-3"></span>
                  تأكد من وجود رصيد كافٍ في البطاقة
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-secondary rounded-full ml-3"></span>
                  تأكد من أن البطاقة غير منتهية الصلاحية
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-secondary rounded-full ml-3"></span>
                  في حالة استمرار المشكلة، تواصل مع البنك
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-6 mt-8">
          <KioskButton
            variant="outline"
            size="xl"
            onClick={handleCancel}
            className="min-w-[200px] ml-4"
          >
            إلغاء والعودة للرئيسية
          </KioskButton>
          
          <KioskButton
            variant="confirm"
            size="xl"
            onClick={handleTryAgain}
            className="min-w-[200px]"
          >
            <RefreshCw className="w-5 h-5 ml-2" />
            المحاولة مرة أخرى
          </KioskButton>
        </div>

        {/* Support Info */}
        <Card className="mt-8 p-6 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              هل تحتاج مساعدة؟
            </h3>
            <p className="text-muted-foreground">
              للمساعدة الفنية، يرجى التواصل مع الإدارة أو الاتصال على الرقم المكتوب على الجهاز
            </p>
            <div className="bg-muted/50 rounded-lg p-3 mt-4">
              <p className="text-sm font-mono text-foreground">
                رقم العملية المرجعي: #{Math.random().toString(36).substr(2, 9).toUpperCase()}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </KioskLayout>
  );
};

export default ErrorPage;