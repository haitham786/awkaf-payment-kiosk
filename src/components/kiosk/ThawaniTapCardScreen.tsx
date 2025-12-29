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
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Logo at top center */}
      {logoImage && (
        <div className="relative z-10 w-full flex justify-center pt-6">
          <img 
            src={logoImage} 
            alt="Organization Logo" 
            className="h-16 w-auto object-contain"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {/* Amount Display */}
        <div className="mb-8 text-center">
          <p className="text-white/80 text-sm mb-1">Amount to Pay</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-white text-5xl font-bold tracking-tight drop-shadow-lg">
              {formatAmount(amount)}
            </span>
            <span className="text-white/80 text-xl font-medium">OMR</span>
          </div>
        </div>

        {/* NFC Animation Area */}
        <div className="relative w-64 h-64 mb-8">
          {/* Ripple Effects */}
          {stage === "waiting" && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-48 h-48 rounded-full border-2 border-white/30 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-40 h-40 rounded-full border-2 border-white/40 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.3s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-32 h-32 rounded-full border-2 border-white/50 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.6s" }}
                />
              </div>
            </>
          )}

          {/* Processing Spinner */}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            </div>
          )}

          {/* Center Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
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
                <Wifi className="w-14 h-14 text-white animate-pulse" />
              )}
              {stage === "processing" && (
                <CreditCard className="w-14 h-14 text-white" />
              )}
              {stage === "success" && (
                <span className="text-5xl text-white">✓</span>
              )}
              {stage === "declined" && (
                <span className="text-5xl text-white">✕</span>
              )}
            </div>
          </div>

          {/* Card Illustration for Waiting */}
          {stage === "waiting" && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8">
              <div 
                className="w-20 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-xl animate-bounce border border-yellow-300/50"
                style={{ animationDuration: "1.5s" }}
              >
                <div className="absolute top-1.5 right-1.5 w-6 h-4 bg-yellow-300/40 rounded" />
                <div className="absolute bottom-1.5 left-1.5 right-1.5 h-1 bg-yellow-300/50 rounded" />
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center space-y-2">
          {stage === "waiting" && (
            <>
              <h2 className="text-white text-2xl font-bold drop-shadow-lg">
                ضع بطاقتك على الجهاز
              </h2>
              <p className="text-white/90 text-lg">
                Tap your card to pay
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </>
          )}
          {stage === "processing" && (
            <>
              <h2 className="text-white text-2xl font-bold drop-shadow-lg">
                معالجة العملية...
              </h2>
              <p className="text-white/90 text-lg">
                Processing payment...
              </p>
              <p className="text-white/70 text-sm mt-2">
                Please do not remove your card
              </p>
            </>
          )}
          {stage === "success" && (
            <>
              <h2 className="text-white text-2xl font-bold drop-shadow-lg">
                تمت العملية بنجاح
              </h2>
              <p className="text-green-400 text-lg">
                Payment Approved
              </p>
            </>
          )}
          {stage === "declined" && (
            <>
              <h2 className="text-white text-2xl font-bold drop-shadow-lg">
                تم رفض العملية
              </h2>
              <p className="text-red-400 text-lg">
                Payment Declined
              </p>
            </>
          )}
        </div>
      </div>

      {/* Supported Payment Methods */}
      <div className="relative z-10 px-6 pb-4">
        <div className="flex justify-center items-center gap-3 py-3 px-4 bg-white/10 backdrop-blur-sm rounded-xl">
          <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-5 opacity-90" />
          <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-5 opacity-90" />
          <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-5 opacity-90" />
          <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-5 opacity-90" />
          <img src="/images/payment-logos/gccnet.svg" alt="GCC Net" className="h-5 opacity-90" />
          <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-5 opacity-90" />
        </div>
      </div>

      {/* Trial Mode: Link to proceed to success page */}
      {isTrialMode && stage === "waiting" && (
        <div className="relative z-10 px-6 pb-6">
          <button
            onClick={handleTrialSuccess}
            className="w-full py-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium transition-colors text-sm"
          >
            Trial: Skip to Success Page →
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 px-6 pb-6 text-center">
        <p className="text-white/50 text-xs">
          Secure NFC Payment
        </p>
      </div>
    </div>
  );
};
