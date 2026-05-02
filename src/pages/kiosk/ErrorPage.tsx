import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

const ErrorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const source = searchParams.get('source') || ''; // 'gateway' for Thawani retry
  const [categoryData, setCategoryData] = useState<{ title: string; title_en: string | null; icon_url: string | null } | null>(null);
  const errorType = searchParams.get('error') || 'payment';

  useEffect(() => {
    // After 10s of inactivity on the failure alert, go back to the categories page
    const timer = setTimeout(() => navigate('/kiosk'), 10000);
    return () => clearTimeout(timer);
  }, [navigate]);

  useEffect(() => {
    if (source !== 'gateway') return;
    sessionStorage.removeItem('kiosk_pending_gateway_payment');
    localStorage.removeItem('kiosk_pending_gateway_payment');
  }, [source]);

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) return;
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("title, title_en, icon_url")
          .or(`category_id.eq.${categoryId},id.eq.${categoryId}`)
          .maybeSingle();
        if (error) throw error;
        if (data) setCategoryData(data);
      } catch (error) { console.error("Error loading category data:", error); }
    };
    loadCategoryData();
  }, [categoryId]);

  const errorMessages: Record<string, { ar: string; en: string; descAr: string; descEn: string; icon: string }> = {
    network: { ar: "خطأ في الاتصال", en: "Connection Error", descAr: "تعذر الاتصال بالشبكة، يرجى المحاولة مرة أخرى", descEn: "Network connection failed, please try again", icon: "🌐" },
    card: { ar: "خطأ في البطاقة", en: "Card Error", descAr: "تعذر قراءة البطاقة، يرجى التأكد من البطاقة والمحاولة مرة أخرى", descEn: "Failed to read card, please check your card and try again", icon: "💳" },
    insufficient: { ar: "رصيد غير كافٍ", en: "Insufficient Balance", descAr: "الرصيد في البطاقة غير كافٍ لإتمام العملية", descEn: "Insufficient card balance to complete the transaction", icon: "💰" },
    declined: { ar: "تم رفض العملية", en: "Transaction Declined", descAr: "تم رفض العملية من البنك، يرجى التواصل مع البنك", descEn: "Transaction declined by bank, please contact your bank", icon: "❌" },
    payment: { ar: "فشل عملية الدفع", en: "Payment Failed", descAr: "تم إلغاء أو فشل عملية الدفع. يمكنك المحاولة مرة أخرى بنفس المبلغ.", descEn: "The payment was cancelled or failed. You may try again with the same amount.", icon: "⚠️" },
  };

  const errorInfo = errorMessages[errorType] || errorMessages.payment;

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const handleTryAgain = () => {
    if (source === 'gateway') {
      // Re-launch Thawani gateway with same amount
      navigate(`/kiosk/thawani-gateway?category=${categoryId}&amount=${amount}&retry=${Date.now()}`, { replace: true });
    } else {
      navigate(`/kiosk/amount?category=${categoryId}`);
    }
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto space-y-4">
        {categoryData && (
          <div className="text-center">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 shadow-md border-0">
              {categoryData.icon_url && (
                <div className="flex justify-center mb-2">
                  <img src={categoryData.icon_url} alt={categoryData.title} className="w-12 h-12 object-contain" />
                </div>
              )}
              <h2 className="text-lg font-bold text-gray-900">{categoryData.title}</h2>
              {categoryData.title_en && <p className="text-sm text-gray-600">{categoryData.title_en}</p>}
            </div>
          </div>
        )}

        <Card className="p-6 bg-white shadow-lg border-2 border-red-300 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-50 rounded-full shadow-md flex items-center justify-center border-2 border-red-300">
              <span className="text-3xl">{errorInfo.icon}</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-red-600">{errorInfo.ar}</h2>
              <p className="text-sm text-red-400">{errorInfo.en}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-base font-semibold mb-1 text-gray-900">تفاصيل العملية المتأثرة:</h3>
              <p className="text-xs text-gray-400 mb-3">Affected Transaction Details:</p>
              <div className="text-center">
                <p className="text-gray-600 mb-0.5 text-sm">المبلغ <span className="text-xs text-gray-400">Amount</span></p>
                <p className="text-2xl font-bold text-emerald-700 flex items-center justify-center gap-2">
                  <CurrencyLogo className="h-5" />
                  {formatAmountNum(amount)}
                </p>
              </div>
            </div>
          </div>
        </Card>

      </div>

      {/* Action buttons - outside and underneath the red frame */}
      <div className="w-full max-w-3xl mx-auto mt-6 flex items-stretch justify-center gap-4 px-2">
        <KioskButton
          variant="confirm"
          size="xl"
          onClick={() => navigate('/kiosk')}
          className="flex-1 max-w-[260px] min-h-[72px] px-8 py-4 bg-white/80 hover:bg-white/90 backdrop-blur-sm text-gray-900 border border-white/40 rounded-xl flex items-center justify-center"
        >
          <span className="flex flex-col items-center leading-tight">
            <span className="text-base font-bold">إلغاء</span>
            <span className="text-xs font-normal text-gray-500 mt-0.5">Cancel</span>
          </span>
        </KioskButton>

        <KioskButton
          variant="confirm"
          size="xl"
          onClick={handleTryAgain}
          className="flex-1 max-w-[260px] min-h-[72px] px-8 py-4 bg-white/80 hover:bg-white/90 backdrop-blur-sm text-gray-900 border border-white/40 rounded-xl flex items-center justify-center gap-3"
        >
          <RefreshCw className="w-5 h-5 shrink-0" />
          <span className="flex flex-col items-center leading-tight">
            <span className="text-base font-bold">المحاولة مرة أخرى</span>
            <span className="text-xs font-normal text-gray-500 mt-0.5">Try Again</span>
          </span>
        </KioskButton>
      </div>
    </KioskLayout>
  );
};

export default ErrorPage;
