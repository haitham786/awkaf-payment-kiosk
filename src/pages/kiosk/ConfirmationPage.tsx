import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft } from "lucide-react";

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');

  const getCategoryName = (categoryId: string) => {
    const categories: Record<string, string> = {
      'zakat': 'زكاة',
      'sadaqah': 'صدقة',
      'charity': 'خيرية',
      'mosque': 'مسجد',
      'orphans': 'أيتام',
      'education': 'تعليم'
    };
    return categories[categoryId] || 'تبرع';
  };

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  const handleConfirm = () => {
    navigate(`/kiosk/payment-request?category=${category}&amount=${amount}`);
  };

  const handleBack = () => {
    navigate(`/kiosk/amount?category=${category}`);
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            تأكيد التبرع
          </h1>
          <p className="text-base text-gray-600">
            يرجى مراجعة تفاصيل التبرع قبل المتابعة
          </p>
        </div>

        {/* Confirmation Card */}
        <Card className="p-6 bg-white/60 backdrop-blur-sm shadow-lg border-0 text-center">
          <div className="space-y-4">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full shadow-md flex items-center justify-center">
              <span className="text-3xl">📿</span>
            </div>

            {/* Donation Details */}
            <div className="space-y-3">
              <div className="bg-gray-50/60 rounded-lg p-4 border-0">
                <p className="text-sm text-gray-600 mb-1">نوع التبرع</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {getCategoryName(category)}
                </p>
              </div>

              <div className="bg-emerald-50/60 rounded-lg p-4 border-0">
                <p className="text-sm text-gray-600 mb-1">مبلغ التبرع</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {formatAmount(amount)}
                </p>
              </div>
            </div>

            {/* Islamic Quote */}
            <div className="bg-gray-50/60 rounded-lg p-4 border-0">
              <p className="text-base font-medium text-gray-800">
                "مَّن ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا فَيُضَاعِفَهُ لَهُ أَضْعَافًا كَثِيرَةً"
              </p>
              <p className="text-xs text-gray-600 mt-2">
                سورة البقرة - آية 245
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-4">
          <KioskButton
            variant="outline"
            size="xl"
            onClick={handleBack}
            className="min-w-[160px] ml-4 bg-white/60 backdrop-blur-sm border-0 hover:bg-gray-100/60 text-gray-900"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            تعديل المبلغ
          </KioskButton>
          
          <KioskButton
            variant="confirm"
            size="xl"
            onClick={handleConfirm}
            className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          >
            تأكيد والدفع
            <ArrowLeft className="w-5 h-5 mr-2" />
          </KioskButton>
        </div>

        {/* Additional Info */}
        <div className="text-center mt-4">
          <p className="text-gray-600 text-sm">
            سيتم تحويل المبلغ بعد تأكيد الدفع بالبطاقة
          </p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ConfirmationPage;