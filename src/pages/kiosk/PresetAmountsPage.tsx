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
      <div className="w-full max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="bg-card/30 backdrop-blur-xl rounded-2xl p-6 shadow-neon border-2 border-primary/40">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              اختر مبلغ التبرع
            </h1>
            <p className="text-xl text-primary font-semibold">
              {getCategoryName(categoryId)}
            </p>
          </div>
        </div>

        {/* Preset Amount Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {presetAmounts.map((amount, index) => (
            <Card
              key={amount}
              className="p-0 overflow-hidden bg-card/20 backdrop-blur-md border-2 border-primary/30 shadow-card hover:shadow-neon transition-all duration-300 hover:scale-105 transform-3d group"
            >
              <KioskButton
                variant="donation"
                className="w-full h-full flex flex-col items-center justify-center space-y-4 py-8 border-0 rounded-xl"
                onClick={() => handleAmountSelect(amount)}
                style={{
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                <div className="text-6xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {amount}
                </div>
                <p className="text-xl text-muted-foreground group-hover:text-primary/80 transition-colors">
                  ريال عماني
                </p>
              </KioskButton>
            </Card>
          ))}
        </div>

        {/* Custom Amount Button */}
        <div className="flex justify-center pt-8">
          <KioskButton
            variant="secondary"
            size="lg"
            onClick={handleCustomAmount}
            className="px-16 py-8 text-2xl font-bold shadow-neon hover:shadow-glow"
          >
            إدخال مبلغ مختلف
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PresetAmountsPage;
