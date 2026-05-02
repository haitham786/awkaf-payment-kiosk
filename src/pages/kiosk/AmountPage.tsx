import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Delete, Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";

const AmountPage = () => {
  const [rialAmount, setRialAmount] = useState("");
  const [baisaAmount, setBaisaAmount] = useState("");
  const [activeField, setActiveField] = useState<"rial" | "baisa">("rial");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryId = searchParams.get("category");
  const [categoryData, setCategoryData] = useState<{ title: string; title_en: string | null; icon_url: string | null; category_id: string } | null>(() => readCachedCategory(categoryId));

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) return;
      try {
        const cached = readCachedCategory(categoryId);
        if (cached) {
          setCategoryData(cached);
          return;
        }

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

  const handleNumberClick = (num: string) => {
    if (activeField === "rial") {
      setRialAmount(prev => prev + num);
    } else {
      if (baisaAmount.length >= 3) return;
      setBaisaAmount(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (activeField === "rial") setRialAmount(prev => prev.slice(0, -1));
    else setBaisaAmount(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (activeField === "rial") setRialAmount("");
    else setBaisaAmount("");
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
      <div className="w-full max-w-[18rem] mx-auto flex flex-col h-full pb-24">
        {/* Category header */}
        <div className="text-center mb-1 shrink-0">
          <div className="flex flex-col items-center justify-center gap-0.5">
            {categoryData?.icon_url && (
              <img src={categoryData.icon_url} alt={categoryData.title} className="w-10 h-10 object-contain" loading="eager" />
            )}
            <h1 className="text-base font-bold text-gray-900 drop-shadow-sm leading-tight">
              {categoryData?.title || "أدخل مبلغ التبرع"}
            </h1>
            {categoryData?.title_en && (
              <p className="text-xs text-gray-600 leading-tight">{categoryData.title_en}</p>
            )}
            {!categoryData?.title && (
              <p className="text-xs text-gray-600">Enter Donation Amount</p>
            )}
          </div>
        </div>

        {/* Amount fields - side by side, above the dial */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          {/* Rial Field */}
          <div
            className={`backdrop-blur-sm shadow-md rounded-lg cursor-pointer transition-all p-2 aspect-[2/1] flex flex-col items-center justify-center ${
              activeField === "rial" ? "bg-emerald-50/90 border-2 border-emerald-500" : "bg-white/60 border-2 border-gray-200"
            }`}
            onClick={() => setActiveField("rial")}
          >
            <div className="text-center text-2xl font-bold text-emerald-600 flex items-center justify-center gap-1.5 leading-none">
              <CurrencyLogo className="h-5" />
              {rialAmount || "0"}
            </div>
            <p className="text-center text-[0.6rem] text-gray-600 mt-1">ریال عماني / Rials</p>
          </div>

          {/* Baisa Field */}
          <div
            className={`backdrop-blur-sm shadow-md rounded-lg cursor-pointer transition-all p-2 aspect-[2/1] flex flex-col items-center justify-center ${
              activeField === "baisa" ? "bg-blue-50/90 border-2 border-blue-500" : "bg-white/60 border-2 border-gray-200"
            }`}
            onClick={() => setActiveField("baisa")}
          >
            <div className="text-center text-2xl font-bold text-blue-600 leading-none">
              {baisaAmount || "0"}
            </div>
            <p className="text-center text-[0.6rem] text-gray-600 mt-1">بيسة / Baisas</p>
          </div>
        </div>

        {/* Number Pad - square buttons in proper matrix */}
        <div className="grid grid-cols-3 gap-1.5 mt-2 shrink-0 justify-items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <KioskButton
              key={num}
              variant="keypad"
              soundEffect="keypad"
              className="aspect-square w-full text-2xl font-bold bg-white/70 hover:bg-white/90 text-gray-800 border-0 rounded-lg shadow-none hover:shadow-md active:scale-95 transition-all duration-100"
              onClick={() => handleNumberClick(num.toString())}
            >
              {num}
            </KioskButton>
          ))}

          <KioskButton variant="keypad" soundEffect="keypad" className="aspect-square w-full bg-white/70 hover:bg-red-50/90 text-gray-800 border-0 rounded-lg shadow-none hover:shadow-md active:scale-95 transition-all duration-100" onClick={handleBackspace}>
            <Delete className="w-5 h-5" />
          </KioskButton>

          <KioskButton variant="keypad" soundEffect="keypad" className="aspect-square w-full text-2xl font-bold bg-white/70 hover:bg-white/90 text-gray-800 border-0 rounded-lg shadow-none hover:shadow-md active:scale-95 transition-all duration-100" onClick={() => handleNumberClick("0")}>
            0
          </KioskButton>

          <KioskButton
            variant="keypad"
            soundEffect="keypad"
            className="aspect-square w-full bg-white/70 hover:bg-amber-50/90 text-gray-800 border-0 rounded-lg shadow-none hover:shadow-md active:scale-95 transition-all duration-100"
            onClick={handleClear}
            aria-label="Clear"
          >
            <Eraser className="w-5 h-5" />
          </KioskButton>
        </div>

        {/* Confirm Button - centered */}
        <div className="flex justify-center pt-1.5 shrink-0">
          <KioskButton
            variant="confirm"
            size="sm"
            soundEffect="navigation"
            onClick={handleConfirm}
            disabled={(!rialAmount || parseFloat(rialAmount) <= 0) && (!baisaAmount || parseInt(baisaAmount) <= 0)}
            className="px-5 py-1.5 text-sm font-bold bg-emerald-500/80 hover:bg-emerald-600/80 backdrop-blur-sm text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-md rounded-lg flex flex-row items-center gap-2"
          >
            <span>تأكيد</span>
            <span className="text-[0.7rem] opacity-80">Confirm</span>
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default AmountPage;
