import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";
import { getCachedPaymentMode, loadKioskRuntimeConfig } from "@/lib/kioskConfig";
import { warmHardwarePos } from "@/lib/hardwarePosWarm";

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [categoryData, setCategoryData] = useState<{title: string; title_en: string | null; icon_url: string | null} | null>(() => readCachedCategory(category));

  // Final wake-up so the SALE dispatches the instant the donor confirms.
  useEffect(() => {
    warmHardwarePos();
  }, []);

  useEffect(() => {
    const loadCategory = async () => {
      const cached = readCachedCategory(category);
      if (cached) {
        setCategoryData(cached);
        return;
      }

      const { data } = await supabase.from('donation_categories').select('title, title_en, icon_url').eq('category_id', category).maybeSingle();
      if (data) {
        storeCategoryInCache({ ...data, category_id: category });
        setCategoryData(data);
      }
    };
    loadCategory();
  }, [category]);

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const handleConfirm = () => {
    const kioskId = localStorage.getItem('kiosk_id');
    if (kioskId) {
      const mode = getCachedPaymentMode(kioskId);
      if (mode === 'test_payment') {
        navigate(`/kiosk/test-payment?category=${category}&amount=${amount}`);
        return;
      }
      if (mode === 'payment_gateway') {
        navigate(`/kiosk/thawani-gateway?category=${category}&amount=${amount}`);
        return;
      }
      if (mode === 'hardware_pos') {
        // Refresh the heartbeat at the donor's final tap without waiting for it.
        // This also repairs a connection that dropped while the donor was idle.
        void warmHardwarePos(true);
        navigate(`/kiosk/hardware-pos?category=${category}&amount=${amount}`);
        return;
      }
      if (mode === 'soft_pos') {
        navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
        return;
      }

      // First run only: resolve the mode on the lightweight routing screen.
      // Never hold the donor on confirmation while waiting for the network.
      void loadKioskRuntimeConfig(kioskId).catch((error) => {
        console.warn('Unable to refresh kiosk payment mode:', error);
      });
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
            <div className="w-20 h-20 mx-auto flex items-center justify-center p-1">
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

        <div className="flex justify-center gap-4 mt-4 pb-24">
          <KioskButton
            variant="outline"
            size="xl"
            soundEffect="navigation"
            onClick={handleBack}
            className="min-w-[160px] bg-white/40 backdrop-blur-sm border-0 hover:bg-white/60 text-gray-900"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            <span className="flex flex-col items-start">
              <span>تعديل المبلغ</span>
              <span className="text-xs text-gray-500">Edit Amount</span>
            </span>
          </KioskButton>
          
          <KioskButton
            variant="outline"
            size="xl"
            soundEffect="navigation"
            onClick={handleConfirm}
            className="min-w-[160px] bg-white/40 backdrop-blur-sm border-0 hover:bg-white/60 text-gray-900"
          >
            <span className="flex flex-col items-end">
              <span>التأكيد و الدفع</span>
              <span className="text-xs text-gray-500">Confirm & Pay</span>
            </span>
            <ArrowLeft className="w-5 h-5 mr-2" />
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ConfirmationPage;
