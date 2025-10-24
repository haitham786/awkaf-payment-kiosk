import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Delete } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AmountPage = () => {
  const [rialAmount, setRialAmount] = useState("");
  const [baisaAmount, setBaisaAmount] = useState("");
  const [activeField, setActiveField] = useState<"rial" | "baisa">("rial");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryId = searchParams.get("category");
  const [categoryData, setCategoryData] = useState<{ name: string; icon_url: string } | null>(null);

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
          setCategoryData({ name: data.title, icon_url: data.icon_url });
        }
      } catch (error) {
        console.error("Error loading category data:", error);
      }
    };

    loadCategoryData();
  }, [categoryId]);

  const handleNumberClick = (num: string) => {
    if (activeField === "rial") {
      if (num === "." && rialAmount.includes(".")) return;
      if (rialAmount === "" && num === ".") {
        setRialAmount("0.");
        return;
      }
      setRialAmount(prev => prev + num);
    } else {
      // Baisa field - max 3 digits, no decimal
      if (num === ".") return;
      if (baisaAmount.length >= 3) return;
      setBaisaAmount(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (activeField === "rial") {
      setRialAmount(prev => prev.slice(0, -1));
    } else {
      setBaisaAmount(prev => prev.slice(0, -1));
    }
  };

  const handleConfirm = () => {
    const rials = parseFloat(rialAmount || "0");
    const baisas = parseInt(baisaAmount || "0");
    
    if (rials <= 0 && baisas <= 0) return;
    
    const totalBaisas = (rials * 1000) + baisas;
    navigate(`/kiosk/confirmation?category=${categoryId}&amount=${totalBaisas}`);
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-2xl mx-auto space-y-3">
        {/* Header with Category */}
        <div className="text-center">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 shadow-md border-0">
            {categoryData?.icon_url && (
              <div className="flex justify-center mb-2">
                <img 
                  src={categoryData.icon_url} 
                  alt={categoryData.name}
                  className="w-10 h-10 object-contain"
                />
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-900 mb-1">
              {categoryData?.name || "أدخل مبلغ التبرع"}
            </h1>
            <p className="text-sm text-gray-600">الرجاء إدخال المبلغ بالريال والبيسة</p>
          </div>
        </div>

        {/* Rial Field */}
        <Card 
          className={`backdrop-blur-sm shadow-md border-2 cursor-pointer transition-all ${
            activeField === "rial" 
              ? "bg-emerald-50/90 border-emerald-500" 
              : "bg-white/60 border-gray-200"
          }`}
          onClick={() => setActiveField("rial")}
        >
          <div className="p-3">
            <Input
              type="text"
              value={rialAmount || "0"}
              readOnly
              className="text-center text-3xl font-bold bg-transparent border-none focus:ring-0 text-emerald-600 h-12"
            />
            <p className="text-center text-sm text-gray-600 mt-1">ریال عماني</p>
          </div>
        </Card>

        {/* Baisa Field */}
        <Card 
          className={`backdrop-blur-sm shadow-md border-2 cursor-pointer transition-all ${
            activeField === "baisa" 
              ? "bg-blue-50/90 border-blue-500" 
              : "bg-white/60 border-gray-200"
          }`}
          onClick={() => setActiveField("baisa")}
        >
          <div className="p-3">
            <Input
              type="text"
              value={baisaAmount || "0"}
              readOnly
              className="text-center text-3xl font-bold bg-transparent border-none focus:ring-0 text-blue-600 h-12"
            />
            <p className="text-center text-sm text-gray-600 mt-1">بيسة</p>
          </div>
        </Card>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Card
              key={num}
              className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <KioskButton
                variant="keypad"
                soundEffect="keypad"
                className="w-full h-14 text-xl font-bold text-gray-800 hover:bg-emerald-50/60 border-0 rounded-xl"
                onClick={() => handleNumberClick(num.toString())}
              >
                {num}
              </KioskButton>
            </Card>
          ))}

          {/* Backspace */}
          <Card className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
            <KioskButton
              variant="keypad"
              soundEffect="keypad"
              className="w-full h-14 text-gray-800 hover:bg-red-50/60 border-0 rounded-xl"
              onClick={handleBackspace}
            >
              <Delete className="w-5 h-5" />
            </KioskButton>
          </Card>

          {/* Zero */}
          <Card className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
            <KioskButton
              variant="keypad"
              soundEffect="keypad"
              className="w-full h-14 text-xl font-bold text-gray-800 hover:bg-emerald-50/60 border-0 rounded-xl"
              onClick={() => handleNumberClick("0")}
            >
              0
            </KioskButton>
          </Card>

          {/* Decimal Point (only for Rial) */}
          <Card className="overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
            <KioskButton
              variant="keypad"
              soundEffect="keypad"
              className="w-full h-14 text-xl font-bold text-gray-800 hover:bg-emerald-50/60 border-0 rounded-xl"
              onClick={() => activeField === "rial" && handleNumberClick(".")}
              disabled={activeField === "baisa"}
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
            disabled={(!rialAmount || parseFloat(rialAmount) <= 0) && (!baisaAmount || parseInt(baisaAmount) <= 0)}
            className="px-10 py-2.5 text-base font-bold bg-emerald-500/80 hover:bg-emerald-600/80 backdrop-blur-sm text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-md rounded-xl"
          >
            تأكيد
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default AmountPage;
