import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";

interface TerminalTapScreenProps {
  amount: number;
  category?: string;
  stage: "waiting" | "processing";
  onCancel?: () => void;
  onTimeout?: () => void;
  timeoutSeconds?: number;
}

/**
 * Full-screen prompt shown while an external hardware EFTPOS terminal
 * (Ahli Bank / AFS via ApexECR) waits for the donor to tap their card.
 */
export const TerminalTapScreen: React.FC<TerminalTapScreenProps> = ({
  amount,
  category,
  stage,
  onCancel,
  onTimeout,
  timeoutSeconds = 90,
}) => {
  const navigate = useNavigate();
  const [backgroundImage, setBackgroundImage] = useState<string>(
    () => localStorage.getItem("kiosk_background_url") || "",
  );
  const [logoImage, setLogoImage] = useState<string>(() => localStorage.getItem("kiosk_logo_url") || "");
  const [categoryData, setCategoryData] = useState<{
    title: string;
    title_en: string | null;
    icon_url: string | null;
  } | null>(() => readCachedCategory(category));

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from("kiosk_settings")
          .select("background_image_url, logo_url")
          .limit(1)
          .maybeSingle();
        if (data?.background_image_url) {
          localStorage.setItem("kiosk_background_url", data.background_image_url);
          setBackgroundImage(data.background_image_url);
        }
        if (data?.logo_url) {
          localStorage.setItem("kiosk_logo_url", data.logo_url);
          setLogoImage(data.logo_url);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadCategory = async () => {
      if (!category) return;
      const cached = readCachedCategory(category);
      if (cached) {
        setCategoryData(cached);
        return;
      }
      const { data } = await supabase
        .from("donation_categories")
        .select("title, title_en, icon_url")
        .eq("category_id", category)
        .maybeSingle();
      if (data) {
        storeCategoryInCache({ ...data, category_id: category });
        setCategoryData(data);
      }
    };
    loadCategory();
  }, [category]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (onTimeout) onTimeout();
      else navigate("/kiosk");
    }, timeoutSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [navigate, onTimeout, timeoutSeconds]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div className="w-full flex justify-center items-center pt-2 pb-2 min-h-[64px]">
        {logoImage && (
          <img src={logoImage} alt="Organization Logo" className="h-12 w-auto object-contain max-w-[220px]" />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="mb-4 text-center min-h-[100px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 mb-2 flex items-center justify-center">
            {categoryData?.icon_url && (
              <img src={categoryData.icon_url} alt={categoryData.title} className="w-full h-full object-contain" />
            )}
          </div>
          <p className="text-lg font-bold text-gray-900 min-h-[28px]">{categoryData?.title || ""}</p>
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
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-40 h-40 rounded-full border-2 border-emerald-400/40 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-32 h-32 rounded-full border-2 border-emerald-400/50 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.4s" }}
                />
              </div>
            </>
          )}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
              <CreditCard className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        <div className="text-center space-y-1 mb-6">
          <h2 className="text-gray-900 text-xl font-bold">استخدم جهاز الدفع المجاور</h2>
          <p className="text-gray-600 text-sm">Use the payment terminal next to the kiosk</p>
          <p className="text-gray-500 text-xs pt-1">
            {stage === "processing" ? "بانتظار البطاقة… / Waiting for card…" : "جاري التحضير… / Preparing…"}
          </p>
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

      <div className="px-6 pb-5 flex justify-center">
        <button
          onClick={() => onCancel?.()}
          className="px-8 py-3 rounded-xl bg-white/50 hover:bg-white/70 backdrop-blur-sm shadow-sm flex flex-col items-center leading-tight"
        >
          <span className="text-base font-bold text-gray-900">إلغاء</span>
          <span className="text-xs text-gray-900">Cancel</span>
        </button>
      </div>
    </div>
  );
};
