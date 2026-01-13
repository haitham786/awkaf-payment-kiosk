/**
 * Thawani-branded "Tap Card" Full-Screen UI
 * 
 * This component displays a branded NFC tap card screen for Soft POS payments.
 * Used in TRIAL/MOCK mode to simulate the Thawani Lamsa SDK experience.
 */

import React from "react";
import { CreditCard, Smartphone, Wifi } from "lucide-react";

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
  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-[#1a1f3c] via-[#252b4d] to-[#1a1f3c]">
      {/* Thawani Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          {/* Thawani Logo Placeholder */}
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">ث</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Thawani Lamsa</p>
            <p className="text-purple-300 text-xs">Soft POS</p>
          </div>
        </div>
        {isTrialMode && (
          <div className="px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40">
            <span className="text-yellow-400 text-xs font-medium">TRIAL MODE</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Amount Display */}
        <div className="mb-8 text-center">
          <p className="text-purple-300 text-sm mb-1">Amount to Pay</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-white text-5xl font-bold tracking-tight">
              {formatAmount(amount)}
            </span>
            <span className="text-purple-300 text-xl font-medium">OMR</span>
          </div>
        </div>

        {/* NFC Animation Area */}
        <div className="relative w-64 h-64 mb-8">
          {/* Ripple Effects */}
          {stage === "waiting" && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-48 h-48 rounded-full border-2 border-purple-400/30 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-40 h-40 rounded-full border-2 border-purple-400/40 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.3s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-32 h-32 rounded-full border-2 border-purple-400/50 animate-ping"
                  style={{ animationDuration: "2s", animationDelay: "0.6s" }}
                />
              </div>
            </>
          )}

          {/* Processing Spinner */}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 rounded-full border-4 border-purple-500/30 border-t-purple-400 animate-spin" />
            </div>
          )}

          {/* Center Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                stage === "waiting" 
                  ? "bg-gradient-to-br from-purple-500 to-pink-500"
                  : stage === "processing"
                  ? "bg-gradient-to-br from-blue-500 to-purple-500"
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
              <h2 className="text-white text-2xl font-bold">
                ضع بطاقتك على الجهاز
              </h2>
              <p className="text-purple-300 text-lg">
                Tap your card to pay
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </>
          )}
          {stage === "processing" && (
            <>
              <h2 className="text-white text-2xl font-bold">
                معالجة العملية...
              </h2>
              <p className="text-purple-300 text-lg">
                Processing payment...
              </p>
              <p className="text-purple-400/70 text-sm mt-2">
                Please do not remove your card
              </p>
            </>
          )}
          {stage === "success" && (
            <>
              <h2 className="text-white text-2xl font-bold">
                تمت العملية بنجاح
              </h2>
              <p className="text-green-400 text-lg">
                Payment Approved
              </p>
            </>
          )}
          {stage === "declined" && (
            <>
              <h2 className="text-white text-2xl font-bold">
                تم رفض العملية
              </h2>
              <p className="text-red-400 text-lg">
                Payment Declined
              </p>
            </>
          )}
        </div>
      </div>

      {/* Supported Cards */}
      <div className="px-6 pb-4">
        <div className="flex justify-center items-center gap-4 py-3 px-4 bg-white/5 rounded-xl">
          <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-6 opacity-80" />
          <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-6 opacity-80" />
          <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-6 opacity-80" />
          <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-6 opacity-80" />
        </div>
      </div>

      {/* Cancel Button */}
      {(stage === "waiting" || stage === "processing") && onCancel && (
        <div className="px-6 pb-8">
          <button
            onClick={onCancel}
            disabled={stage === "processing"}
            className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء - Cancel
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 pb-6 text-center">
        <p className="text-purple-400/50 text-xs">
          Powered by Thawani Pay • Secure NFC Payment
        </p>
        {isTrialMode && (
          <p className="text-yellow-500/60 text-xs mt-1">
            Trial Mode - Transactions are simulated
          </p>
        )}
      </div>
    </div>
  );
};
