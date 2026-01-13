/**
 * Soft POS "Tap Card" Full-Screen UI
 * 
 * This component displays a branded NFC tap card screen for Soft POS payments.
 * Redesigned to remove Thawani branding and show category/amount info.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ThawaniTapCardScreenProps {
  amount: number;
  category?: string;
  stage: "waiting" | "processing" | "success" | "declined";
  isTrialMode?: boolean;
  onCancel?: () => void;
  onTimeout?: () => void;
}

export const ThawaniTapCardScreen: React.FC<ThawaniTapCardScreenProps> = ({
  amount,
  category,
  stage,
  isTrialMode = true,
  onCancel,
  onTimeout,
}) => {
  const navigate = useNavigate();
  const [backgroundImage, setBackgroundImage] = useState<string>(() => {
    return localStorage.getItem('kiosk_background_url') || "";
  });
  const [categoryData, setCategoryData] = useState<{title: string; icon_url: string | null} | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [countdown, setCountdown] = useState(15);

  // Load background image
  useEffect(() => {
    const loadBackground = async () => {
      try {
        const { data } = await supabase
          .from("kiosk_settings")
          .select("background_image_url")
          .limit(1)
          .maybeSingle();

        if (data?.background_image_url) {
          localStorage.setItem('kiosk_background_url', data.background_image_url);
          setBackgroundImage(data.background_image_url);
        }
      } catch (error) {
        console.error("Error loading background:", error);
      }
    };
    loadBackground();
  }, []);

  // Load category data
  useEffect(() => {
    const loadCategory = async () => {
      if (!category) return;
      
      const { data } = await supabase
        .from('donation_categories')
        .select('title, icon_url')
        .eq('category_id', category)
        .maybeSingle();
      
      if (data) {
        if (data.icon_url) {
          const img = new Image();
          img.src = data.icon_url;
          img.onload = () => {
            setImageLoaded(true);
            setCategoryData(data);
          };
          img.onerror = () => {
            setImageLoaded(true);
            setCategoryData(data);
          };
        } else {
          setImageLoaded(true);
          setCategoryData(data);
        }
      }
    };
    loadCategory();
  }, [category]);

  // 15 second timeout for inactivity
  useEffect(() => {
    if (stage !== 'waiting') return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onTimeout) {
            onTimeout();
          } else {
            navigate('/kiosk');
          }
          return 0;
        }
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
    <div 
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#f5f5f5',
      }}
    >
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Category Info - Fixed height container */}
        <div className="mb-4 text-center min-h-[80px] flex flex-col items-center justify-center">
          {categoryData?.icon_url && imageLoaded && (
            <div className="w-14 h-14 mb-2">
              <img 
                src={categoryData.icon_url} 
                alt={categoryData.title}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          {categoryData?.title && (
            <p className="text-lg font-bold text-gray-900">
              {categoryData.title}
            </p>
          )}
        </div>

        {/* Amount Display - Black text */}
        <div className="mb-6 text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-gray-900 text-4xl font-bold tracking-tight">
              {formatAmount(amount)}
            </span>
            <span className="text-gray-700 text-xl font-medium">ر.ع</span>
          </div>
        </div>

        {/* NFC Animation Area */}
        <div className="relative w-48 h-48 mb-6">
          {/* Animated Ripple Effects for waiting stage */}
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
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-24 h-24 rounded-full border-2 border-emerald-400/60 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.8s" }}
                />
              </div>
            </>
          )}

          {/* Processing Spinner */}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            </div>
          )}

          {/* Center NFC Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                stage === "waiting" 
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                  : stage === "processing"
                  ? "bg-gradient-to-br from-blue-500 to-emerald-500"
                  : stage === "success"
                  ? "bg-gradient-to-br from-green-500 to-emerald-500"
                  : "bg-gradient-to-br from-red-500 to-pink-500"
              }`}
            >
              {stage === "waiting" && (
                <Wifi className="w-10 h-10 text-white animate-pulse" />
              )}
              {stage === "processing" && (
                <Wifi className="w-10 h-10 text-white" />
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

        {/* Instructions - Black text, Arabic only */}
        <div className="text-center space-y-2 mb-6">
          {stage === "waiting" && (
            <h2 className="text-gray-900 text-xl font-bold">
              ضع بطاقتك البنكية على الشاشة
            </h2>
          )}
          {stage === "processing" && (
            <h2 className="text-gray-900 text-xl font-bold">
              معالجة العملية...
            </h2>
          )}
          {stage === "declined" && (
            <h2 className="text-red-700 text-xl font-bold">
              تم رفض العملية
            </h2>
          )}
        </div>

        {/* Payment Method Logos - Two rows, smaller, no background */}
        <div className="space-y-2">
          {/* Row 1: VISA, MasterCard, Apple Pay, Samsung Pay */}
          <div className="flex justify-center items-center gap-3">
            <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-5" />
            <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-5" />
            <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-5" />
            <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-5" />
          </div>
          {/* Row 2: OmanNet, GCC Net, Mal */}
          <div className="flex justify-center items-center gap-3">
            <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-5" />
            <img src="/images/payment-logos/gccnet.svg" alt="GCC Net" className="h-5" />
            <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-5" />
          </div>
        </div>
      </div>

      {/* Trial Mode Skip Link (for testing) */}
      {isTrialMode && stage === "waiting" && (
        <div className="px-6 pb-4 text-center">
          <button
            onClick={() => {
              // Trigger mock success
              if (onCancel) onCancel();
            }}
            className="text-gray-500 text-xs underline"
          >
            Trial: Skip to Success Page
          </button>
        </div>
      )}
    </div>
  );
};
