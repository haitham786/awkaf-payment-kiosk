import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

const imageCache = new Map<string, boolean>();

const ThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const transactionId = searchParams.get('transactionId') || '';
  const referenceNumber = searchParams.get('ref') || '';
  const [countdown, setCountdown] = useState(10);
  const [categoryData, setCategoryData] = useState<{title: string; title_en: string | null; icon_url: string | null} | null>(() => {
    const cached = sessionStorage.getItem(`category_${category}`);
    return cached ? JSON.parse(cached) : null;
  });
  const [isReady, setIsReady] = useState(() => !!sessionStorage.getItem(`category_${category}`));

  useEffect(() => {
    const loadCategory = async () => {
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
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); navigate('/kiosk'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const handleSMSReceipt = () => {
    navigate(`/kiosk/mobile-number?category=${category}&amount=${amount}&ref=${referenceNumber}&transactionId=${transactionId}`);
  };

  const handleReturnHome = () => { navigate('/kiosk'); };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[70vh]">
        <Card className="p-6 bg-white/60 backdrop-blur-sm shadow-lg border-0 text-center w-full max-w-md">
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-emerald-700">شكرا لكم</h1>
              <p className="text-lg text-gray-500">Thank You</p>
              <h2 className="text-xl font-semibold text-gray-900">تم قبول تبرعكم بنجاح</h2>
              <p className="text-sm text-gray-500">Your donation has been accepted successfully</p>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 min-h-[80px]">
              <div className="w-16 h-16 flex items-center justify-center">
                {categoryData?.icon_url && isReady && (
                  <img src={categoryData.icon_url} alt={categoryData.title} className="w-full h-full object-contain" />
                )}
              </div>
              <p className="text-lg font-semibold text-gray-900">{categoryData?.title || 'تبرع'}</p>
              {categoryData?.title_en && (
                <p className="text-sm text-gray-500">{categoryData.title_en}</p>
              )}
            </div>

            <div className="py-2">
              <p className="text-3xl font-bold text-emerald-700 flex items-center justify-center gap-2">
                <CurrencyLogo className="h-6" />
                {formatAmountNum(amount)}
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-6 text-center space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">هل تريد إيصال عبر الرسائل النصية؟</h3>
            <p className="text-sm text-gray-500">Would you like an SMS receipt?</p>
          </div>
          
          <KioskButton
            variant="confirm"
            size="xl"
            soundEffect="navigation"
            onClick={handleSMSReceipt}
            className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white border-0 flex flex-col items-center"
          >
            <span>نعم</span>
            <span className="text-xs opacity-80">Yes</span>
          </KioskButton>
        </div>

        <div className="mt-8">
          <KioskButton
            variant="ghost"
            size="lg"
            soundEffect="navigation"
            onClick={handleReturnHome}
            className="bg-transparent hover:bg-white/10 backdrop-blur-sm shadow-none border-0 p-3"
          >
            <Home className="w-8 h-8 text-white drop-shadow-lg" />
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ThankYouPage;
