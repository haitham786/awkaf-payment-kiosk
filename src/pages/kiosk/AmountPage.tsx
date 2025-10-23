import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Backspace } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AmountPage = () => {
  const [amount, setAmount] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryId = searchParams.get("category");
  const [categoryData, setCategoryData] = useState<{ name: string; icon_url: string } | null>(null);

  useEffect(() => {
    if (amount) {
      document.getElementById('amount-display')?.focus();
    }
  }, [amount]);

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) return;
      
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("name_ar, icon_url")
          .eq("id", categoryId)
          .single();

        if (error) throw error;
        
        if (data) {
          setCategoryData({ name: data.name_ar, icon_url: data.icon_url });
        }
      } catch (error) {
        console.error("Error loading category data:", error);
      }
    };

    loadCategoryData();
  }, [categoryId]);

  const handleNumberClick = (num: string) => {
    if (num === "." && amount.includes(".")) return;
    
    if (amount === "" && num === ".") {
      setAmount("0.");
      return;
    }

    setAmount(prev => prev + num);
  };

  const handleBackspace = () => {
    setAmount(prev => prev.slice(0, -1));
  };

  const handleConfirm = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    const amountInBaisas = Math.round(parseFloat(amount) * 1000);
    navigate(`/kiosk/confirmation?category=${categoryId}&amount=${amountInBaisas}`);
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto space-y-4">
        {/* Header with Category */}
        <div className="text-center">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-md border-0">
            {categoryData?.icon_url && (
              <div className="flex justify-center mb-2">
                <img 
                  src={categoryData.icon_url} 
                  alt={categoryData.name}
                  className="w-12 h-12 object-contain"
                />
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-900 mb-1">
              {categoryData?.name || "أدخل مبلغ التبرع"}
            </h1>
            <p className="text-sm text-gray-600">الرجاء إدخال المبلغ بالريال العماني</p>
          </div>
        </div>

        {/* Amount Display */}
        <Card className="bg-white/60 backdrop-blur-sm shadow-md border-0">
          <div className="p-4">
            <Input
              id="amount-display"
              type="text"
              value={amount || "0"}
              readOnly
              className="text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-emerald-600 h-16"
            />
            <p className="text-center text-base text-gray-500 mt-1">ریال عماني</p>
          </div>
        </Card>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Card
              key={num}
              className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              <KioskButton
                variant="keypad"
                soundEffect="keypad"
                className="w-full h-16 text-2xl font-bold text-gray-800 hover:bg-emerald-50/60 border-0 rounded-xl"
                onClick={() => handleNumberClick(num.toString())}
              >
                {num}
              </KioskButton>
            </Card>
          ))}

          {/* Backspace */}
          <Card className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <KioskButton
              variant="keypad"
              soundEffect="keypad"
              className="w-full h-16 text-gray-800 hover:bg-red-50/60 border-0 rounded-xl"
              onClick={handleBackspace}
            >
              <Backspace className="w-6 h-6" />
            </KioskButton>
          </Card>

          {/* Zero */}
          <Card className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <KioskButton
              variant="keypad"
              soundEffect="keypad"
              className="w-full h-16 text-2xl font-bold text-gray-800 hover:bg-emerald-50/60 border-0 rounded-xl"
              onClick={() => handleNumberClick("0")}
            >
              0
            </KioskButton>
          </Card>

          {/* Decimal Point */}
          <Card className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <KioskButton
              variant="keypad"
              soundEffect="keypad"
              className="w-full h-16 text-2xl font-bold text-gray-800 hover:bg-emerald-50/60 border-0 rounded-xl"
              onClick={() => handleNumberClick(".")}
            >
              .
            </KioskButton>
          </Card>
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center pt-2">
          <KioskButton
            variant="confirm"
            size="lg"
            soundEffect="navigation"
            onClick={handleConfirm}
            disabled={!amount || parseFloat(amount) <= 0}
            className="px-12 py-3 text-lg font-bold bg-emerald-500/80 hover:bg-emerald-600/80 backdrop-blur-sm text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-md rounded-xl"
          >
            تأكيد
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default AmountPage;