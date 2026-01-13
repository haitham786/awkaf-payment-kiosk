import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";

// Cache for preloaded images
const imageCache = new Map<string, string>();

const PresetAmountsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("category");
  const [categoryData, setCategoryData] = useState<{ title: string; icon_url: string | null; category_id: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Remove 500 from preset amounts
  const presetAmounts = [1, 3, 5, 10, 20, 30, 50, 100, 200];

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) {
        setIsReady(true);
        return;
      }
      
      // Check if already cached
      const cachedIcon = imageCache.get(categoryId);
      
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("title, icon_url, category_id")
          .eq("category_id", categoryId)
          .single();

        if (error) throw error;
        
        if (data) {
          // If image is cached or no image, show immediately
          if (cachedIcon || !data.icon_url) {
            setCategoryData(data);
            setIsReady(true);
          } else {
            // Preload the image
            const img = new Image();
            img.src = data.icon_url;
            img.onload = () => {
              imageCache.set(categoryId, data.icon_url!);
              setCategoryData(data);
              setIsReady(true);
            };
            img.onerror = () => {
              setCategoryData(data);
              setIsReady(true);
            };
          }
        } else {
          setIsReady(true);
        }
      } catch (error) {
        console.error("Error loading category data:", error);
        setIsReady(true);
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
      <div className="w-full max-w-xl mx-auto space-y-1.5 pt-1 pb-24">
        {/* Header with Category - Fixed height container for stability */}
        <div className="text-center">
          <div className="flex flex-col items-center justify-center gap-1 mb-1 min-h-[70px]">
            {/* Fixed height placeholder for image - matched to w-14 h-14 like other pages */}
            <div className="w-14 h-14 flex items-center justify-center">
              {categoryData?.icon_url && isReady && (
                <img 
                  src={categoryData.icon_url} 
                  alt={categoryData.title}
                  className="w-14 h-14 object-contain"
                />
              )}
            </div>
            <h1 className="text-lg font-bold text-gray-900 drop-shadow-sm">
              {categoryData?.title || "اختر مبلغ التبرع"}
            </h1>
          </div>
        </div>

        {/* Preset Amount Grid - 3x3 grid for 9 amounts */}
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          {presetAmounts.map((amount) => (
            <Card
              key={amount}
              className="p-0 overflow-hidden bg-white/70 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] group"
            >
              <KioskButton
                variant="donation"
                soundEffect="keypad"
                className="w-full h-full flex flex-col items-center justify-center py-2 space-y-0.5 border-0 rounded-xl bg-white/70 hover:bg-white/80 backdrop-blur-sm"
                onClick={() => handleAmountSelect(amount)}
              >
                <div className="text-xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {amount}
                </div>
                <p className="text-[0.65rem] text-gray-600 group-hover:text-emerald-600 transition-colors">
                  ر.ع
                </p>
              </KioskButton>
            </Card>
          ))}
        </div>

        {/* Custom Amount Button - Raised up with more margin */}
        <div className="flex justify-center mt-4 pt-2">
          <KioskButton
            variant="secondary"
            size="sm"
            soundEffect="navigation"
            onClick={handleCustomAmount}
            className="px-4 py-1.5 text-xs font-bold bg-white/80 hover:bg-white/90 backdrop-blur-sm text-gray-900 border-0"
          >
            إدخال مبلغ مختلف
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PresetAmountsPage;
