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
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-red-600 mb-1">
            {errorInfo.title}
          </h1>
          <p className="text-base text-gray-600">
            نعتذر عن هذا الإزعاج
          </p>
        </div>

        {/* Error Card */}
        <Card className="p-6 bg-white shadow-lg border-2 border-red-300 text-center">
          <div className="space-y-4">
            {/* Error Icon */}
            <div className="w-16 h-16 mx-auto bg-red-50 rounded-full shadow-md flex items-center justify-center border-2 border-red-300">
              <span className="text-3xl">{errorInfo.icon}</span>
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-red-600">
                {errorInfo.title}
              </h2>
              <p className="text-base text-gray-800 leading-relaxed">
                {errorInfo.description}
              </p>
            </div>

            {/* Transaction Details */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-base font-semibold mb-3 text-gray-900">
                تفاصيل العملية المتأثرة:
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-gray-600 mb-1 text-sm">المبلغ</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatAmount(amount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 mb-1 text-sm">نوع التبرع</p>
                  <p className="text-base font-semibold text-gray-900">
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
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-right">
              <h3 className="text-base font-semibold mb-2 text-gray-900">
                نصائح للحل:
              </h3>
              <ul className="space-y-1 text-sm text-gray-800">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full ml-2"></span>
                  تأكد من أن البطاقة مدخلة بالطريقة الصحيحة
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full ml-2"></span>
                  تأكد من وجود رصيد كافٍ في البطاقة
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full ml-2"></span>
                  تأكد من أن البطاقة غير منتهية الصلاحية
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full ml-2"></span>
                  في حالة استمرار المشكلة، تواصل مع البنك
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-4">
          <KioskButton
            variant="outline"
            size="xl"
            onClick={handleCancel}
            className="min-w-[160px] ml-3 bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-900"
          >
            إلغاء والعودة للرئيسية
          </KioskButton>
          
          <KioskButton
            variant="confirm"
            size="xl"
            onClick={handleTryAgain}
            className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RefreshCw className="w-5 h-5 ml-2" />
            المحاولة مرة أخرى
          </KioskButton>
        </div>

        {/* Support Info */}
        <Card className="mt-4 p-4 bg-white shadow-md border border-gray-300">
          <div className="text-center space-y-2">
            <h3 className="text-base font-semibold text-gray-900">
              هل تحتاج مساعدة؟
            </h3>
            <p className="text-sm text-gray-600">
              للمساعدة الفنية، يرجى التواصل مع الإدارة أو الاتصال على الرقم المكتوب على الجهاز
            </p>
            <div className="bg-gray-100 rounded-lg p-2 mt-3">
              <p className="text-xs font-mono text-gray-800">
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
