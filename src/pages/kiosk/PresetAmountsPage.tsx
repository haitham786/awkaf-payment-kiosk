import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

const imageCache = new Map<string, string>();

const PresetAmountsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("category");
  const [categoryData, setCategoryData] = useState<{ title: string; title_en: string | null; icon_url: string | null; category_id: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

  const presetAmounts = [1, 3, 5, 10, 20, 30, 50, 100, 200];

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) { setIsReady(true); return; }
      const cachedIcon = imageCache.get(categoryId);
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("title, title_en, icon_url, category_id")
          .eq("category_id", categoryId)
          .single();
        if (error) throw error;
        if (data) {
          if (cachedIcon || !data.icon_url) {
            setCategoryData(data);
            setIsReady(true);
          } else {
            const img = new Image();
            img.src = data.icon_url;
            img.onload = () => { imageCache.set(categoryId, data.icon_url!); setCategoryData(data); setIsReady(true); };
            img.onerror = () => { setCategoryData(data); setIsReady(true); };
          }
        } else { setIsReady(true); }
      } catch (error) { console.error("Error loading category data:", error); setIsReady(true); }
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
      <div className="w-full max-w-xl mx-auto space-y-1.5 pt-1 pb-24">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center gap-1 mb-1 min-h-[85px]">
            <div className="w-14 h-14 flex items-center justify-center">
              {categoryData?.icon_url && isReady && (
                <img src={categoryData.icon_url} alt={categoryData.title} className="w-14 h-14 object-contain" />
              )}
            </div>
            <h1 className="text-lg font-bold text-gray-900 drop-shadow-sm">
              {categoryData?.title || "اختر مبلغ التبرع"}
            </h1>
            {categoryData?.title_en && (
              <p className="text-sm text-gray-600">{categoryData.title_en}</p>
            )}
            {!categoryData?.title && (
              <p className="text-sm text-gray-600">Select Donation Amount</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          {presetAmounts.map((amount) => (
            <Card
              key={amount}
              className="p-0 overflow-hidden liquid-glass border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] group rounded-2xl"
            >
              <KioskButton
                variant="donation"
                soundEffect="keypad"
                className="w-full h-full flex flex-row items-center justify-center py-3 gap-1.5 border-0 rounded-2xl min-h-0 p-3"
                onClick={() => handleAmountSelect(amount)}
              >
                <CurrencyLogo className="h-4" />
                <div className="text-xl font-bold text-foreground group-hover:text-emerald-700 transition-colors">
                  {amount}
                </div>
              </KioskButton>
            </Card>
          ))}
        </div>

        <div className="flex flex-col items-center mt-4 pt-2 gap-0.5">
          <KioskButton
            variant="secondary"
            size="sm"
            soundEffect="navigation"
            onClick={handleCustomAmount}
            className="px-4 py-1.5 text-xs font-bold text-foreground border-0"
          >
            إدخال مبلغ مختلف
          </KioskButton>
          <span className="text-xs text-muted-foreground">Enter a different amount</span>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PresetAmountsPage;
