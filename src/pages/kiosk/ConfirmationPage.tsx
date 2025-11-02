import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [categoryData, setCategoryData] = useState<{title: string; icon_url: string | null} | null>(null);

  useEffect(() => {
    const loadCategory = async () => {
      const { data, error } = await supabase
        .from('donation_categories')
        .select('title, icon_url')
        .eq('category_id', category)
        .maybeSingle();
      
      if (data) {
        setCategoryData(data);
      }
    };
    
    loadCategory();
  }, [category]);

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
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">
            تأكيد المبلغ
          </h1>
        </div>

        {/* Confirmation Card */}
        <Card className="p-6 bg-white/60 backdrop-blur-sm shadow-lg border-0 text-center">
          <div className="space-y-4">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto rounded-full shadow-md flex items-center justify-center p-1">
              {categoryData?.icon_url ? (
                <img src={categoryData.icon_url} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full w-full h-full flex items-center justify-center">
                  <span className="text-3xl">📿</span>
                </div>
              )}
            </div>

            {/* Donation Details */}
            <div className="space-y-3">
              <div className="bg-gray-50/60 rounded-lg p-4 border-0">
                <p className="text-sm text-gray-600 mb-1">نوع التبرع</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {categoryData?.title || 'تبرع'}
                </p>
              </div>

              <div className="bg-emerald-50/60 rounded-lg p-4 border-0">
                <p className="text-sm text-gray-600 mb-1">مبلغ التبرع</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {formatAmount(amount)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-4 pb-20">
          <KioskButton
            variant="outline"
            size="xl"
            soundEffect="navigation"
            onClick={handleBack}
            className="min-w-[160px] ml-4 bg-white/60 backdrop-blur-sm border-0 hover:bg-gray-100/60 text-gray-900"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            تعديل المبلغ
          </KioskButton>
          
          <KioskButton
            variant="confirm"
            size="xl"
            soundEffect="navigation"
            onClick={handleConfirm}
            className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          >
            تأكيد والدفع
            <ArrowLeft className="w-5 h-5 mr-2" />
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ConfirmationPage;