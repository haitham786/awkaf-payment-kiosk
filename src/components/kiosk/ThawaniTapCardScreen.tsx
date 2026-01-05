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
        <div className="mb-6 text-center">
          <p className="text-white/80 text-sm mb-1">Amount to Pay</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-white text-4xl font-bold tracking-tight drop-shadow-lg">
              {formatAmount(amount)}
            </span>
            <span className="text-white/80 text-lg font-medium">OMR</span>
          </div>
        </div>

        {/* NFC Animation Area */}
        <div className="relative w-48 h-48 mb-6">
          {/* Ripple Effects */}
          {stage === "waiting" && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-40 h-40 rounded-full border-2 border-white/30 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-32 h-32 rounded-full border-2 border-white/40 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.3s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-24 h-24 rounded-full border-2 border-white/50 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.6s" }}
                />
              </div>
            </>
          )}

          {/* Processing Spinner */}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            </div>
          )}

          {/* Center Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
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
                <Wifi className="w-10 h-10 text-white animate-pulse" />
              )}
              {stage === "processing" && (
                <CreditCard className="w-10 h-10 text-white" />
              )}
              {stage === "success" && (
                <span className="text-4xl text-white">✓</span>
              )}
              {stage === "declined" && (
                <span className="text-4xl text-white">✕</span>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center space-y-2">
          {stage === "waiting" && (
            <>
              <h2 className="text-white text-xl font-bold drop-shadow-lg">
                يرجى وضع البطاقة البنكية على الشاشة
              </h2>
              <p className="text-white/90 text-base">
                Please place your card on the screen
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </>
          )}
          {stage === "processing" && (
            <>
              <h2 className="text-white text-xl font-bold drop-shadow-lg">
                معالجة العملية...
              </h2>
              <p className="text-white/90 text-base">
                Processing payment...
              </p>
              <p className="text-white/70 text-sm mt-2">
                Please do not remove your card
              </p>
            </>
          )}
          {stage === "success" && (
            <>
              <h2 className="text-white text-xl font-bold drop-shadow-lg">
                تمت العملية بنجاح
              </h2>
              <p className="text-green-400 text-base">
                Payment Approved
              </p>
            </>
          )}
          {stage === "declined" && (
            <>
              <h2 className="text-white text-xl font-bold drop-shadow-lg">
                تم رفض العملية
              </h2>
              <p className="text-red-400 text-base">
                Payment Declined
              </p>
            </>
          )}
        </div>
      </div>

      {/* Supported Payment Methods - Two rows, smaller logos */}
      <div className="relative z-10 px-6 pb-3">
        <div className="flex flex-col items-center gap-2 py-3 px-4 bg-white/10 backdrop-blur-sm rounded-xl">
          {/* Row 1: Visa, Mastercard, Apple Pay, Samsung Pay */}
          <div className="flex justify-center items-center gap-4">
            <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-4 opacity-90" />
            <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-4 opacity-90" />
            <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-4 opacity-90" />
            <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-4 opacity-90" />
          </div>
          {/* Row 2: OmanNet, GCC Net, Mal */}
          <div className="flex justify-center items-center gap-4">
            <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-4 opacity-90" />
            <img src="/images/payment-logos/gccnet.svg" alt="GCC Net" className="h-4 opacity-90" />
            <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-4 opacity-90" />
          </div>
        </div>
      </div>

      {/* Trial Mode: Link to proceed to success page */}
      {isTrialMode && stage === "waiting" && (
        <div className="relative z-10 px-6 pb-4">
          <button
            onClick={handleTrialSuccess}
            className="w-full py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium transition-colors text-sm"
          >
            Trial: Skip to Success Page →
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 px-6 pb-4 text-center">
        <p className="text-white/50 text-xs">
          Secure NFC Payment
        </p>
      </div>
    </div>
  );
};
