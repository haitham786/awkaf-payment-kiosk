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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            تأكيد التبرع
          </h1>
          <p className="text-xl text-muted-foreground">
            يرجى مراجعة تفاصيل التبرع قبل المتابعة
          </p>
        </div>

        {/* Confirmation Card */}
        <Card className="p-12 bg-card/90 backdrop-blur-sm shadow-elegant border-2 border-primary/30 text-center">
          <div className="space-y-8">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto bg-gradient-primary rounded-full shadow-elegant flex items-center justify-center animate-glow">
              <span className="text-4xl">📿</span>
            </div>

            {/* Donation Details */}
            <div className="space-y-6">
              <div className="bg-gradient-card rounded-lg p-6 border border-primary/20">
                <p className="text-lg text-muted-foreground mb-2">نوع التبرع</p>
                <p className="text-3xl font-bold text-secondary">
                  {getCategoryName(category)}
                </p>
              </div>

              <div className="bg-gradient-primary/10 rounded-lg p-8 border-2 border-primary/40">
                <p className="text-lg text-muted-foreground mb-2">مبلغ التبرع</p>
                <p className="text-5xl font-bold text-primary">
                  {formatAmount(amount)}
                </p>
              </div>
            </div>

            {/* Islamic Quote */}
            <div className="bg-secondary/10 rounded-lg p-6 border border-secondary/30">
              <p className="text-lg font-medium text-foreground">
                "مَّن ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا فَيُضَاعِفَهُ لَهُ أَضْعَافًا كَثِيرَةً"
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                سورة البقرة - آية 245
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-6 mt-8">
          <KioskButton
            variant="outline"
            size="xl"
            onClick={handleBack}
            className="min-w-[200px] ml-4"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            تعديل المبلغ
          </KioskButton>
          
          <KioskButton
            variant="confirm"
            size="xl"
            onClick={handleConfirm}
            className="min-w-[200px]"
          >
            تأكيد والدفع
            <ArrowLeft className="w-5 h-5 mr-2" />
          </KioskButton>
        </div>

        {/* Additional Info */}
        <div className="text-center mt-8">
          <p className="text-muted-foreground">
            سيتم تحويل المبلغ بعد تأكيد الدفع بالبطاقة
          </p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ConfirmationPage;