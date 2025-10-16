import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";

const PresetAmountsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("category");

  const presetAmounts = [1, 3, 5, 10, 20, 30, 50, 100, 200, 500];

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

  const getCategoryName = (categoryId: string | null) => {
    const categoryNames: { [key: string]: string } = {
      sadaqah: "صدقة جارية",
      zakat: "زكاة",
      kaffarah: "كفارة",
      aqeeqah: "عقيقة",
    };
    return categoryId ? categoryNames[categoryId] || "تبرع عام" : "تبرع عام";
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="bg-gray-50/60 rounded-xl p-4 shadow-sm border-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              اختر مبلغ التبرع
            </h1>
            <p className="text-lg text-emerald-700 font-semibold">
              {getCategoryName(categoryId)}
            </p>
          </div>
        </div>

        {/* Preset Amount Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {presetAmounts.map((amount, index) => (
            <Card
              key={amount}
              className="p-0 overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 group"
            >
              <KioskButton
                variant="donation"
                soundEffect="keypad"
                className="w-full h-full flex flex-col items-center justify-center space-y-1 py-3 border-0 rounded-xl bg-gradient-to-br from-emerald-50/60 to-emerald-100/60 hover:from-emerald-100/60 hover:to-emerald-200/60 min-h-[100px]"
                onClick={() => handleAmountSelect(amount)}
              >
                <div className="text-3xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {amount}
                </div>
                <p className="text-xs text-gray-600 group-hover:text-emerald-600 transition-colors">
                  ريال عماني
                </p>
              </KioskButton>
            </Card>
          ))}
        </div>

        {/* Custom Amount Button */}
        <div className="flex justify-center pt-6">
          <KioskButton
            variant="secondary"
            size="lg"
            soundEffect="navigation"
            onClick={handleCustomAmount}
            className="px-10 py-3 text-lg font-bold bg-gray-200 hover:bg-gray-300 text-gray-900 border-2 border-gray-400"
          >
            إدخال مبلغ مختلف
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PresetAmountsPage;
