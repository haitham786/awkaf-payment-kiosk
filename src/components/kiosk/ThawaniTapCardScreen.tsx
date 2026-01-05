/**
 * Soft POS "Tap Card" Full-Screen UI
 * 
 * This component displays an NFC tap card screen for Soft POS payments.
 * Used in TRIAL/MOCK mode with admin-configured background.
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Wifi, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ThawaniTapCardScreenProps {
  amount: number;
  stage: "waiting" | "processing" | "success" | "declined";
  isTrialMode?: boolean;
  onCancel?: () => void;
}

export const ThawaniTapCardScreen: React.FC<ThawaniTapCardScreenProps> = ({
  amount,
  stage,
  isTrialMode = true,
  onCancel,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  
  const [backgroundImage, setBackgroundImage] = useState<string>(() => {
    return localStorage.getItem('kiosk_background_url') || "";
  });
  const [logoImage, setLogoImage] = useState<string>(() => {
    return localStorage.getItem('kiosk_logo_url') || "";
  });
  const [categoryData, setCategoryData] = useState<{title: string; icon_url: string | null} | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from("kiosk_settings")
          .select("background_image_url, logo_url")
          .limit(1)
          .maybeSingle();

        if (data) {
          if (data.background_image_url) {
            localStorage.setItem('kiosk_background_url', data.background_image_url);
            setBackgroundImage(data.background_image_url);
          }
          if (data.logo_url) {
            localStorage.setItem('kiosk_logo_url', data.logo_url);
            setLogoImage(data.logo_url);
          }
        }
      } catch (error) {
        console.error("Error loading kiosk settings:", error);
      }
    };
    loadSettings();
  }, []);

  // Load category data
  useEffect(() => {
    const loadCategory = async () => {
      const { data } = await supabase
        .from('donation_categories')
        .select('title, icon_url')
        .eq('category_id', category)
        .maybeSingle();
      
      if (data) {
        setCategoryData(data);
      }
    };
    loadCategory();
  }, [category]);

  // Auto-timeout for trial mode - simulate success after 10 seconds
  useEffect(() => {
    if (isTrialMode && stage === "waiting") {
      const timeout = setTimeout(() => {
        handleTrialSuccess();
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isTrialMode, stage]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, "0")}`;
  };

  const handleTrialSuccess = () => {
    // Navigate to thank you page for trial testing
    navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=TRIAL-${Date.now()}&catRef=`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'linear-gradient(to bottom right, #1a1f3c, #252b4d, #1a1f3c)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Logo at top center */}
      {logoImage && (
        <div className="relative z-10 w-full flex justify-center pt-4">
          <img 
            src={logoImage} 
            alt="Organization Logo" 
            className="h-14 w-auto object-contain"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {/* Category Display with Thumbnail */}
        <div className="mb-4 text-center">
          {categoryData?.icon_url && (
            <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden shadow-lg">
              <img 
                src={categoryData.icon_url} 
                alt="" 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {categoryData?.title && (
            <p className="text-black text-lg font-semibold">
              {categoryData.title}
            </p>
          )}
        </div>

        {/* Amount Display */}
        <div className="mb-4 text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-black text-4xl font-bold tracking-tight">
              {formatAmount(amount)}
            </span>
            <span className="text-black/80 text-lg font-medium">OMR</span>
          </div>
        </div>

        {/* NFC Animation Area */}
        <div className="relative w-40 h-40 mb-4">
          {/* Ripple Effects */}
          {stage === "waiting" && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-36 h-36 rounded-full border-2 border-emerald-500/40 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-28 h-28 rounded-full border-2 border-emerald-500/50 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.3s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-20 h-20 rounded-full border-2 border-emerald-500/60 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.6s" }}
                />
              </div>
            </>
          )}

          {/* Processing Spinner */}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full border-4 border-blue-300 border-t-blue-600 animate-spin" />
            </div>
          )}

          {/* Center Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                stage === "waiting" 
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-700"
                  : stage === "processing"
                  ? "bg-gradient-to-br from-blue-500 to-blue-700"
                  : stage === "success"
                  ? "bg-gradient-to-br from-green-500 to-emerald-500"
                  : "bg-gradient-to-br from-red-500 to-pink-500"
              }`}
            >
              {stage === "waiting" && (
                <Wifi className="w-8 h-8 text-white animate-pulse" />
              )}
              {stage === "processing" && (
                <CreditCard className="w-8 h-8 text-white" />
              )}
              {stage === "success" && (
                <span className="text-3xl text-white">✓</span>
              )}
              {stage === "declined" && (
                <span className="text-3xl text-white">✕</span>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center space-y-1">
          {stage === "waiting" && (
            <h2 className="text-black text-lg font-bold">
              يرجى وضع البطاقة البنكية على الشاشة
            </h2>
          )}
          {stage === "processing" && (
            <>
              <h2 className="text-black text-lg font-bold">
                معالجة العملية...
              </h2>
              <p className="text-black/70 text-sm">
                Please do not remove your card
              </p>
            </>
          )}
          {stage === "success" && (
            <h2 className="text-emerald-700 text-lg font-bold">
              تمت العملية بنجاح
            </h2>
          )}
          {stage === "declined" && (
            <h2 className="text-red-700 text-lg font-bold">
              تم رفض العملية
            </h2>
          )}
        </div>
      </div>

      {/* Supported Payment Methods - Two rows, smaller logos */}
      <div className="relative z-10 px-6 pb-2">
        <div className="flex flex-col items-center gap-1.5 py-2 px-3 bg-white/20 backdrop-blur-sm rounded-xl">
          {/* Row 1: Visa, Mastercard, Apple Pay, Samsung Pay */}
          <div className="flex justify-center items-center gap-3">
            <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-3 opacity-90" />
            <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-3 opacity-90" />
            <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-3 opacity-90" />
            <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-3 opacity-90" />
          </div>
          {/* Row 2: OmanNet, GCC Net, Mal */}
          <div className="flex justify-center items-center gap-3">
            <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-3 opacity-90" />
            <img src="/images/payment-logos/gccnet.svg" alt="GCC Net" className="h-3 opacity-90" />
            <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-3 opacity-90" />
          </div>
        </div>
      </div>

      {/* Trial Mode: Link to proceed to success page */}
      {isTrialMode && stage === "waiting" && (
        <div className="relative z-10 px-6 pb-3">
          <button
            onClick={handleTrialSuccess}
            className="w-full py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium transition-colors text-sm"
          >
            Trial: Skip to Success Page →
          </button>
        </div>
      )}
    </div>
  );
};
