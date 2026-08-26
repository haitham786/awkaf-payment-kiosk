import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";
import { warmHardwarePos } from "@/lib/hardwarePosWarm";

const PresetAmountsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("category");
  const [categoryData, setCategoryData] = useState<{ title: string; title_en: string | null; icon_url: string | null; category_id: string } | null>(() => readCachedCategory(categoryId));

  const presetAmounts = [1, 3, 5, 10, 20, 30, 50, 100, 200];

  // Wake the payment backend while the donor picks a preset amount.
  useEffect(() => {
    warmHardwarePos();
  }, []);

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) return;
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("title, title_en, icon_url, category_id")
          .eq("category_id", categoryId)
          .single();
        if (error) throw error;
        if (data) {
          storeCategoryInCache(data);
          setCategoryData(data);
        }
      } catch (error) { console.error("Error loading category data:", error); }
    };
    loadCategoryData();
  }, [categoryId]);

  const handleAmountSelect = (amount: number) => {
    const amountInBaisas = amount * 1000;
    navigate(`/kiosk/confirmation?category=${categoryId}&amount=${amountInBaisas}`);
  };

  const handleCustomAmount = () => {
    navigate(`/kiosk/amount?category=${categoryId}`);
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-md mx-auto flex flex-col h-full pb-24">
        <div className="text-center shrink-0">
          <div className="flex flex-col items-center justify-center gap-0.5 mb-1 min-h-[60px]">
            <div className="w-10 h-10 flex items-center justify-center">
              {categoryData?.icon_url && (
                <img src={categoryData.icon_url} alt={categoryData.title} className="w-10 h-10 object-contain" />
              )}
            </div>
            <h1 className="text-base font-bold text-gray-900 drop-shadow-sm leading-tight">
              {categoryData?.title || "اختر مبلغ التبرع"}
            </h1>
            {categoryData?.title_en && (
              <p className="text-xs text-gray-600 leading-tight">{categoryData.title_en}</p>
            )}
            {!categoryData?.title && (
              <p className="text-xs text-gray-600">Select Donation Amount</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[20rem] mx-auto flex-1 min-h-0 content-center justify-items-center auto-rows-max">
          {presetAmounts.map((amount) => (
            <Card
              key={amount}
              className="p-0 overflow-hidden bg-white/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] group aspect-square w-full max-w-[6.25rem]"
            >
              <KioskButton
                variant="donation"
                soundEffect="keypad"
                className="w-full h-full min-h-0 aspect-square flex flex-row items-center justify-center gap-1 border-0 rounded-xl bg-white/50 hover:bg-white/70 backdrop-blur-sm p-0"
                onClick={() => handleAmountSelect(amount)}
              >
                <CurrencyLogo className="h-3.5" />
                <div className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {amount}
                </div>
              </KioskButton>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-center mt-4 mb-10 shrink-0">
          <KioskButton
            variant="secondary"
            size="sm"
            soundEffect="navigation"
            onClick={handleCustomAmount}
            className="h-auto px-10 py-4 text-xs font-bold bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 flex flex-col items-center gap-2 rounded-xl"
          >
            <span className="text-sm">إدخال مبلغ مختلف</span>
            <span className="text-gray-500">Enter a different amount</span>
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PresetAmountsPage;
