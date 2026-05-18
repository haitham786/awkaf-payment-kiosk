import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
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

  const errorMessages: Record<string, { ar: string; en: string; descAr: string; descEn: string }> = {
    network: { ar: "خطأ في الاتصال", en: "Connection Error", descAr: "تعذر الاتصال بالشبكة، يرجى المحاولة مرة أخرى", descEn: "Network connection failed, please try again" },
    card: { ar: "خطأ في البطاقة", en: "Card Error", descAr: "تعذر قراءة البطاقة، يرجى التأكد من البطاقة والمحاولة مرة أخرى", descEn: "Failed to read card, please check your card and try again" },
    insufficient: { ar: "رصيد غير كافٍ", en: "Insufficient Balance", descAr: "الرصيد في البطاقة غير كافٍ لإتمام العملية", descEn: "Insufficient card balance to complete the transaction" },
    declined: { ar: "تم رفض العملية", en: "Transaction Declined", descAr: "", descEn: "" },
    payment: { ar: "تعذر إتمام عملية الدفع", en: "Transaction Declined", descAr: "", descEn: "" },
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
      <div className="w-full max-w-md mx-auto flex flex-col justify-center gap-3 pb-24">
        {categoryData && (
          <div className="text-center">
            <div className="bg-card/70 backdrop-blur-sm rounded-xl p-3 shadow-md border-0">
              {categoryData.icon_url && (
                <div className="flex justify-center mb-2">
                  <img src={categoryData.icon_url} alt={categoryData.title} className="w-12 h-12 object-contain" />
                </div>
              )}
              <h2 className="text-lg font-bold text-card-foreground">{categoryData.title}</h2>
              {categoryData.title_en && <p className="text-sm text-muted-foreground">{categoryData.title_en}</p>}
            </div>
          </div>
        )}

        <Card className="px-5 py-8 bg-white/50 backdrop-blur-sm shadow-sm text-center rounded-xl">
          <div className="space-y-5">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full shadow-md flex items-center justify-center">
              <X className="w-9 h-9 text-destructive" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              <div className="leading-tight flex flex-col items-center">
                <h2 className="text-2xl font-bold text-destructive tracking-normal">{errorInfo.ar}</h2>
                <p className="text-sm text-destructive/70 mt-1">{errorInfo.en}</p>
              </div>
              {(errorInfo.descAr || errorInfo.descEn) && (
                <div className="leading-tight flex flex-col items-center">
                  {errorInfo.descAr && <p className="text-base font-bold text-gray-900 tracking-normal">{errorInfo.descAr}</p>}
                  {errorInfo.descEn && <p className="text-xs text-gray-500 mt-1">{errorInfo.descEn}</p>}
                </div>
              )}
            </div>

            <div className="bg-muted/60 rounded-lg p-4 border border-border">
              <h3 className="text-base font-semibold mb-1 text-card-foreground">تفاصيل العملية</h3>
              <p className="text-xs text-muted-foreground mb-3">Transaction Details</p>
              <div className="text-center">
                <p className="text-muted-foreground mb-0.5 text-sm">المبلغ <span className="text-xs opacity-70">Amount</span></p>
                <p className="text-2xl font-bold text-success flex items-center justify-center gap-2">
                  <CurrencyLogo className="h-5" />
                  {formatAmountNum(amount)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 px-1 pt-2 items-stretch">
          <KioskButton
            variant="secondary"
            size="xl"
            onClick={() => navigate('/kiosk')}
            className="h-auto min-h-[82px] px-8 py-5 bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 rounded-xl shadow-sm flex items-center justify-center"
          >
            <span className="flex flex-col items-center leading-tight">
              <span className="text-base font-bold text-gray-900 tracking-normal">إلغاء</span>
              <span className="text-xs font-normal text-gray-900 mt-1">Cancel</span>
            </span>
          </KioskButton>

          <KioskButton
            variant="secondary"
            size="xl"
            onClick={handleTryAgain}
            className="h-auto min-h-[82px] px-8 py-5 bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 rounded-xl shadow-sm flex items-center justify-center"
          >
            <span className="flex flex-col items-center leading-tight">
              <span className="text-base font-bold text-gray-900 tracking-normal">المحاولة مرة أخرى</span>
              <span className="text-xs font-normal text-gray-900 mt-1">Try Again</span>
            </span>
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ErrorPage;
