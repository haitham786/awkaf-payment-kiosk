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
  /** True while the cancellation is being pushed to the terminal. */
  cancelling?: boolean;
  /** True when the terminal has not acknowledged the amount within a few seconds. */
  slowDispatch?: boolean;
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
  cancelling = false,
  slowDispatch = false,
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
      {/* Logo — identical position/size to KioskLayout */}
      <div className="relative z-10 w-full flex justify-center items-center pt-2 pb-2 min-h-[64px] shrink-0">
        {logoImage && (
          <img src={logoImage} alt="Organization Logo" className="h-12 w-auto object-contain max-w-[220px]" />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="w-full max-w-md rounded-3xl bg-white/45 backdrop-blur-xl border border-white/60 shadow-xl px-5 py-5 flex flex-col items-center">
          {/* Category */}
          <div className="text-center flex flex-col items-center">
            <div className="w-12 h-12 mb-1 flex items-center justify-center">
              {categoryData?.icon_url && (
                <img src={categoryData.icon_url} alt={categoryData.title} className="w-full h-full object-contain" />
              )}
            </div>
            <p className="text-base font-bold text-gray-900 leading-tight">{categoryData?.title || ""}</p>
            {categoryData?.title_en && <p className="text-xs text-gray-600">{categoryData.title_en}</p>}
          </div>

          {/* Amount */}
          <div className="mt-3 flex items-baseline justify-center gap-2">
            <CurrencyLogo className="h-6" />
            <span className="text-gray-900 text-3xl font-bold tracking-tight">{formatAmount(amount)}</span>
          </div>

          {/* Tap animation */}
          <div className="relative w-36 h-36 my-3">
            {stage === "waiting" && (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-32 h-32 rounded-full border-2 border-emerald-400/40 animate-ping"
                    style={{ animationDuration: "2s" }}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-24 h-24 rounded-full border-2 border-emerald-400/50 animate-ping"
                    style={{ animationDuration: "2s", animationDelay: "0.5s" }}
                  />
                </div>
              </>
            )}
            {stage === "processing" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border-4 border-emerald-500/25 border-t-emerald-500 animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                <CreditCard className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Instruction */}
          <div className="text-center leading-tight">
            <h2 className="text-gray-900 text-xl font-bold">الرجاء تمرير البطاقة على جهاز الدفع</h2>
            <p className="text-gray-600 text-sm mt-1">Please tap your card on the POS terminal</p>
            <p className="text-gray-500 text-xs mt-2">
              {cancelling
                ? "جاري إلغاء العملية على جهاز الدفع… / Cancelling at the terminal…"
                : stage === "processing"
                  ? "بانتظار البطاقة… / Waiting for card…"
                  : "جاري التحضير… / Preparing…"}
            </p>
            {slowDispatch && !cancelling && (
              <p className="text-amber-700 text-[0.7rem] mt-2 leading-snug">
                شبكة جهاز الدفع بطيئة حالياً، المبلغ في طريقه إلى الجهاز
                <span className="block text-amber-600/80">
                  The terminal network is slow right now — the amount is still on its way.
                </span>
              </p>
            )}
          </div>


          {/* Accepted payment methods */}
          <div className="mt-4 pt-4 w-full border-t border-white/70">
            <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-3">
              <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-6 w-auto object-contain" />
              <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-7 w-auto object-contain" />
              <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-8 w-auto object-contain" />
              <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-6 w-auto object-contain" />
              <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-6 w-auto object-contain" />
              <img src="/images/payment-logos/googlepay.svg" alt="Google Pay" className="h-7 w-auto object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-5 flex justify-center">
        <button
          onClick={() => onCancel?.()}
          disabled={cancelling}
          className="px-8 py-3 rounded-xl bg-white/50 hover:bg-white/70 backdrop-blur-sm shadow-sm flex flex-col items-center leading-tight disabled:opacity-60"
        >
          <span className="text-base font-bold text-gray-900">{cancelling ? "جاري الإلغاء…" : "إلغاء"}</span>
          <span className="text-xs text-gray-900">{cancelling ? "Cancelling…" : "Cancel"}</span>
        </button>
      </div>
    </div>
  );
};
