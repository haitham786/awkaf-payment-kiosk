import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

const imageCache = new Map<string, boolean>();

interface ThawaniTapCardScreenProps {
  amount: number;
  category?: string;
  stage: "waiting" | "processing" | "success" | "declined";
  isTrialMode?: boolean;
  onCancel?: () => void;
  onTimeout?: () => void;
}

export const ThawaniTapCardScreen: React.FC<ThawaniTapCardScreenProps> = ({
  amount, category, stage, isTrialMode = true, onCancel, onTimeout,
}) => {
  const navigate = useNavigate();
  const [backgroundImage, setBackgroundImage] = useState<string>(() => localStorage.getItem('kiosk_background_url') || "");
  const [logoImage, setLogoImage] = useState<string>(() => localStorage.getItem('kiosk_logo_url') || "");
  const [categoryData, setCategoryData] = useState<{title: string; title_en: string | null; icon_url: string | null} | null>(() => {
    const cached = sessionStorage.getItem(`category_${category}`);
    return cached ? JSON.parse(cached) : null;
  });
  const [isReady, setIsReady] = useState(() => !!sessionStorage.getItem(`category_${category}`));
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase.from("kiosk_settings").select("background_image_url, logo_url").limit(1).maybeSingle();
        if (data?.background_image_url) { localStorage.setItem('kiosk_background_url', data.background_image_url); setBackgroundImage(data.background_image_url); }
        if (data?.logo_url) { localStorage.setItem('kiosk_logo_url', data.logo_url); setLogoImage(data.logo_url); }
      } catch (error) { console.error("Error loading settings:", error); }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadCategory = async () => {
      if (!category) { setIsReady(true); return; }
      const cached = sessionStorage.getItem(`category_${category}`);
      if (cached) { setCategoryData(JSON.parse(cached)); setIsReady(true); return; }
      const { data } = await supabase.from('donation_categories').select('title, title_en, icon_url').eq('category_id', category).maybeSingle();
      if (data) {
        sessionStorage.setItem(`category_${category}`, JSON.stringify(data));
        if (data.icon_url && !imageCache.has(data.icon_url)) {
          const img = new Image();
          img.onload = () => { imageCache.set(data.icon_url!, true); setCategoryData(data); setIsReady(true); };
          img.onerror = () => { imageCache.set(data.icon_url!, false); setCategoryData(data); setIsReady(true); };
          img.src = data.icon_url;
        } else { setCategoryData(data); setIsReady(true); }
      } else { setIsReady(true); }
    };
    loadCategory();
  }, [category]);

  useEffect(() => {
    if (stage !== 'waiting') return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); if (onTimeout) onTimeout(); else navigate('/kiosk'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [stage, navigate, onTimeout]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: '#f5f5f5' }}>
      <div className="w-full flex justify-center pt-4 pb-2 min-h-[72px]">
        {logoImage && <img src={logoImage} alt="Organization Logo" className="h-14 w-auto object-contain max-w-[200px]" />}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="mb-4 text-center min-h-[100px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 mb-2 flex items-center justify-center">
            {categoryData?.icon_url && isReady && <img src={categoryData.icon_url} alt={categoryData.title} className="w-full h-full object-contain" />}
          </div>
          <p className="text-lg font-bold text-gray-900 min-h-[28px]">{categoryData?.title || ''}</p>
          {categoryData?.title_en && <p className="text-sm text-gray-600">{categoryData.title_en}</p>}
        </div>

        <div className="mb-6 text-center">
          <div className="flex items-baseline justify-center gap-2">
            <CurrencyLogo className="h-7" />
            <span className="text-gray-900 text-4xl font-bold tracking-tight">{formatAmount(amount)}</span>
          </div>
        </div>

        <div className="relative w-48 h-48 mb-6">
          {stage === "waiting" && (
            <>
              <div className="absolute inset-0 flex items-center justify-center"><div className="w-40 h-40 rounded-full border-2 border-emerald-400/40 animate-ping" style={{ animationDuration: "2s" }} /></div>
              <div className="absolute inset-0 flex items-center justify-center"><div className="w-32 h-32 rounded-full border-2 border-emerald-400/50 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.4s" }} /></div>
              <div className="absolute inset-0 flex items-center justify-center"><div className="w-24 h-24 rounded-full border-2 border-emerald-400/60 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.8s" }} /></div>
            </>
          )}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-40 h-40 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" /></div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${stage === "waiting" ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : stage === "processing" ? "bg-gradient-to-br from-blue-500 to-emerald-500" : stage === "success" ? "bg-gradient-to-br from-green-500 to-emerald-500" : "bg-gradient-to-br from-red-500 to-pink-500"}`}>
              {stage === "waiting" && <Wifi className="w-10 h-10 text-white animate-pulse" />}
              {stage === "processing" && <Wifi className="w-10 h-10 text-white" />}
              {stage === "success" && <span className="text-3xl text-white">✓</span>}
              {stage === "declined" && <span className="text-3xl text-white">✕</span>}
            </div>
          </div>
        </div>

        <div className="text-center space-y-1 mb-6">
          {stage === "waiting" && (
            <>
              <h2 className="text-gray-900 text-xl font-bold">ضع بطاقتك البنكية على الشاشة</h2>
              <p className="text-gray-600 text-sm">Place your bank card on the screen</p>
            </>
          )}
          {stage === "processing" && (
            <>
              <h2 className="text-gray-900 text-xl font-bold">معالجة العملية...</h2>
              <p className="text-gray-600 text-sm">Processing...</p>
            </>
          )}
          {stage === "declined" && (
            <>
              <h2 className="text-red-700 text-xl font-bold">تم رفض العملية</h2>
              <p className="text-red-500 text-sm">Transaction Declined</p>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex justify-center items-center gap-3">
            <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-5" />
            <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-5" />
            <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-5" />
            <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-5" />
          </div>
          <div className="flex justify-center items-center gap-4">
            <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-7" />
            <img src="/images/payment-logos/gccnet.svg" alt="GCC Net" className="h-7" />
            <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-7" />
          </div>
        </div>
      </div>

      {isTrialMode && stage === "waiting" && (
        <div className="px-6 pb-4 text-center">
          <button onClick={() => { if (onCancel) onCancel(); }} className="text-gray-500 text-xs underline">
            Trial: Skip to Success Page
          </button>
        </div>
      )}
    </div>
  );
};
