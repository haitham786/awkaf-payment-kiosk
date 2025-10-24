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
  const [categoryData, setCategoryData] = useState<{ title: string; icon_url: string | null } | null>(null);

  const presetAmounts = [1, 3, 5, 10, 20, 30, 50, 100, 200, 500];

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) return;
      
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("title, icon_url")
          .eq("id", categoryId)
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
      <div className="w-full max-w-6xl mx-auto space-y-4 pb-24">
        {/* Header with Category */}
        <div className="text-center">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 shadow-md border-0">
            {categoryData?.icon_url && (
              <div className="flex justify-center mb-2">
                <img 
                  src={categoryData.icon_url} 
                  alt={categoryData.title}
                  className="w-12 h-12 object-contain"
                />
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {categoryData?.title || "اختر مبلغ التبرع"}
            </h1>
            <p className="text-sm text-gray-600">
              اختر مبلغاً محدداً أو أدخل مبلغاً مختلفاً
            </p>
          </div>
        </div>

        {/* Preset Amount Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {presetAmounts.map((amount, index) => (
            <Card
              key={amount}
              className="p-0 overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 group"
            >
              <KioskButton
                variant="donation"
                soundEffect="keypad"
                className="w-full h-full flex flex-col items-center justify-center space-y-0.5 py-2.5 border-0 rounded-xl bg-gradient-to-br from-emerald-50/60 to-emerald-100/60 hover:from-emerald-100/60 hover:to-emerald-200/60 min-h-[85px]"
                onClick={() => handleAmountSelect(amount)}
              >
                <div className="text-2xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {amount}
                </div>
                <p className="text-[11px] text-gray-600 group-hover:text-emerald-600 transition-colors">
                  ريال عماني
                </p>
              </KioskButton>
            </Card>
          ))}
        </div>

        {/* Custom Amount Button */}
        <div className="flex justify-center mt-8">
          <KioskButton
            variant="secondary"
            size="lg"
            soundEffect="navigation"
            onClick={handleCustomAmount}
            className="px-8 py-2.5 text-base font-bold bg-gray-200 hover:bg-gray-300 text-gray-900 border-2 border-gray-400"
          >
            إدخال مبلغ مختلف
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PresetAmountsPage;
