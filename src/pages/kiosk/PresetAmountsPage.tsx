import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";

const PresetAmountsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("category");
  const [categoryData, setCategoryData] = useState<{ title: string; icon_url: string | null; category_id: string } | null>(null);

  const presetAmounts = [1, 3, 5, 10, 20, 30, 50, 100, 200, 500];

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) return;
      
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("title, icon_url, category_id")
          .eq("category_id", categoryId)
          .single();

        if (error) throw error;
        
        if (data) {
          setCategoryData(data);
        }
      } catch (error) {
        console.error("Error loading category data:", error);
      }
    };

    loadCategoryData();
  }, [categoryId]);

  const handleAmountSelect = (amount: number) => {
    // Convert Rials to Baisas (1 Rial = 1000 Baisas)
    const amountInBaisas = amount * 1000;
    // Navigate directly to confirmation with the selected amount
    navigate(`/kiosk/confirmation?category=${categoryId}&amount=${amountInBaisas}`);
  };

  const handleCustomAmount = () => {
    // Navigate to manual amount entry page
    navigate(`/kiosk/amount?category=${categoryId}`);
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto space-y-2 pb-6">
        {/* Header with Category */}
        <div className="text-center">
          <div className="flex flex-col items-center justify-center gap-1 mb-1">
            {categoryData?.icon_url && (
              <img 
                src={categoryData.icon_url} 
                alt={categoryData.title}
                className="w-12 h-12 object-contain"
                loading="eager"
              />
            )}
            <h1 className="text-xl font-bold text-gray-900 drop-shadow-sm">
              {categoryData?.title || "اختر مبلغ التبرع"}
            </h1>
          </div>
        </div>

        {/* Preset Amount Grid */}
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {presetAmounts.map((amount, index) => (
            <Card
              key={amount}
              className="p-0 overflow-hidden bg-white/70 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 group"
            >
              <KioskButton
                variant="donation"
                soundEffect="keypad"
                className="w-full h-full flex flex-col items-center justify-center py-3 space-y-0.5 border-0 rounded-xl bg-white/70 hover:bg-white/80 backdrop-blur-sm"
                onClick={() => handleAmountSelect(amount)}
              >
                <div className="text-2xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {amount}
                </div>
                <p className="text-xs text-gray-600 group-hover:text-emerald-600 transition-colors">
                  ر.ع
                </p>
              </KioskButton>
            </Card>
          ))}
        </div>

        {/* Custom Amount Button */}
        <div className="flex justify-center mt-3">
          <KioskButton
            variant="secondary"
            size="lg"
            soundEffect="navigation"
            onClick={handleCustomAmount}
            className="px-5 py-1.5 text-sm font-bold bg-white/80 hover:bg-white/90 backdrop-blur-sm text-gray-900 border-0"
          >
            إدخال مبلغ مختلف
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PresetAmountsPage;
