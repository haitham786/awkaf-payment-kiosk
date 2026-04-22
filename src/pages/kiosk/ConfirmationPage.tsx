import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [categoryData, setCategoryData] = useState<{title: string; title_en: string | null; icon_url: string | null} | null>(null);

  useEffect(() => {
    const loadCategory = async () => {
      const { data } = await supabase.from('donation_categories').select('title, title_en, icon_url').eq('category_id', category).maybeSingle();
      if (data) setCategoryData(data);
    };
    loadCategory();
  }, [category]);

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const handleConfirm = async () => {
    const kioskId = localStorage.getItem('kiosk_id');
    if (kioskId) {
      try {
        const { data: kioskData } = await supabase.from('kiosks').select('configuration').eq('id', kioskId).maybeSingle();
        const config = kioskData?.configuration as any;
        if (config?.payment_mode === 'test_payment') {
          navigate(`/kiosk/test-payment?category=${category}&amount=${amount}`);
          return;
        }
        if (config?.payment_mode === 'payment_gateway') {
          navigate(`/kiosk/thawani-gateway?category=${category}&amount=${amount}`);
          return;
        }
        if (config?.payment_mode === 'soft_pos') {
          navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
          return;
        }
      } catch (error) { console.error('Error checking kiosk config:', error); }
    }
    navigate(`/kiosk/payment-request?category=${category}&amount=${amount}`);
  };

  const handleBack = () => {
    navigate(`/kiosk/amount?category=${category}`);
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 drop-shadow-lg">تأكيد المبلغ</h1>
          <p className="text-base text-gray-600">Confirm Amount</p>
        </div>

        <Card className="p-6 bg-white/40 backdrop-blur-sm shadow-lg border-0 text-center">
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full shadow-md flex items-center justify-center p-1">
              {categoryData?.icon_url && (
                <img src={categoryData.icon_url} alt="" className="w-full h-full object-contain" />
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-lg p-4 border-0">
                <p className="text-2xl font-bold text-gray-900">
                  {categoryData?.title || 'تبرع'}
                </p>
                {categoryData?.title_en && (
                  <p className="text-base text-gray-600">{categoryData.title_en}</p>
                )}
              </div>

              <div className="rounded-lg p-4 border-0">
                <p className="text-sm text-gray-600 mb-0.5">مبلغ التبرع</p>
                <p className="text-xs text-gray-400 mb-1">Donation Amount</p>
                <p className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
                  <CurrencyLogo className="h-6" />
                  {formatAmountNum(amount)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-center space-x-4 mt-4 pb-20">
          <KioskButton
            variant="outline"
            size="xl"
            soundEffect="navigation"
            onClick={handleBack}
            className="min-w-[160px] ml-4 bg-white/40 backdrop-blur-sm border-0 hover:bg-gray-100/60 text-gray-900"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            <span className="flex flex-col items-start">
              <span>تعديل المبلغ</span>
              <span className="text-xs text-gray-500">Edit Amount</span>
            </span>
          </KioskButton>
          
          <KioskButton
            variant="confirm"
            size="xl"
            soundEffect="navigation"
            onClick={handleConfirm}
            className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          >
            <span className="flex flex-col items-end">
              <span>التأكيد و الدفع</span>
              <span className="text-xs text-white/80">Confirm & Pay</span>
            </span>
            <ArrowLeft className="w-5 h-5 mr-2" />
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ConfirmationPage;
