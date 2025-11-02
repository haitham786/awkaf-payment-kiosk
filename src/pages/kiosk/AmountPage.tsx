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
  const [categoryData, setCategoryData] = useState<{ title: string; icon_url: string | null; category_id: string } | null>(null);

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
      <div className="w-full max-w-2xl mx-auto space-y-2.5 pb-20">
        {/* Header with Category */}
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            {categoryData?.icon_url && (
              <img 
                src={categoryData.icon_url} 
                alt={categoryData.title}
                className="w-10 h-10 object-contain"
                loading="eager"
              />
            )}
            <h1 className="text-xl font-bold text-white drop-shadow-lg">
              {categoryData?.title || "أدخل مبلغ التبرع"}
            </h1>
          </div>
          <p className="text-base text-white/90 drop-shadow">
            الرجاء اختيار مبلغ التبرع
          </p>
        </div>

        {/* Rial Field */}
        <div 
          className={`backdrop-blur-sm shadow-md rounded-xl cursor-pointer transition-all p-3 ${
            activeField === "rial" 
              ? "bg-emerald-50/90 border-2 border-emerald-500" 
              : "bg-white/60 border-2 border-gray-200"
          }`}
          onClick={() => setActiveField("rial")}
        >
          <div className="text-center text-3xl font-bold text-emerald-600">
            {rialAmount || "0"}
          </div>
          <p className="text-center text-sm text-gray-600 mt-1">ریال عماني</p>
        </div>

        {/* Baisa Field */}
        <div 
          className={`backdrop-blur-sm shadow-md rounded-xl cursor-pointer transition-all p-3 ${
            activeField === "baisa" 
              ? "bg-blue-50/90 border-2 border-blue-500" 
              : "bg-white/60 border-2 border-gray-200"
          }`}
          onClick={() => setActiveField("baisa")}
        >
          <div className="text-center text-3xl font-bold text-blue-600">
            {baisaAmount || "0"}
          </div>
          <p className="text-center text-sm text-gray-600 mt-1">بيسة</p>
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <KioskButton
              key={num}
              variant="keypad"
              soundEffect="keypad"
              className="w-full h-14 text-2xl font-bold bg-white/70 hover:bg-white/90 text-gray-800 border-0 rounded-xl shadow-none hover:shadow-md active:scale-95 transition-all duration-100"
              onClick={() => handleNumberClick(num.toString())}
            >
              {num}
            </KioskButton>
          ))}

          {/* Backspace */}
          <KioskButton
            variant="keypad"
            soundEffect="keypad"
            className="w-full h-14 bg-white/70 hover:bg-red-50/90 text-gray-800 border-0 rounded-xl shadow-none hover:shadow-md active:scale-95 transition-all duration-100"
            onClick={handleBackspace}
          >
            <Delete className="w-6 h-6" />
          </KioskButton>

          {/* Zero */}
          <KioskButton
            variant="keypad"
            soundEffect="keypad"
            className="w-full h-14 text-2xl font-bold bg-white/70 hover:bg-white/90 text-gray-800 border-0 rounded-xl shadow-none hover:shadow-md active:scale-95 transition-all duration-100"
            onClick={() => handleNumberClick("0")}
          >
            0
          </KioskButton>

          {/* Decimal Point (only for Rial) */}
          <KioskButton
            variant="keypad"
            soundEffect="keypad"
            className="w-full h-14 text-2xl font-bold bg-white/70 hover:bg-white/90 text-gray-800 border-0 rounded-xl shadow-none hover:shadow-md active:scale-95 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => activeField === "rial" && handleNumberClick(".")}
            disabled={activeField === "baisa"}
          >
            .
          </KioskButton>
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center pt-2">
          <KioskButton
            variant="confirm"
            size="lg"
            soundEffect="navigation"
            onClick={handleConfirm}
            disabled={(!rialAmount || parseFloat(rialAmount) <= 0) && (!baisaAmount || parseInt(baisaAmount) <= 0)}
            className="px-8 py-2 text-base font-bold bg-emerald-500/80 hover:bg-emerald-600/80 backdrop-blur-sm text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-md rounded-xl"
          >
            تأكيد
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default AmountPage;
