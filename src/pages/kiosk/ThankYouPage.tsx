import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const transactionId = searchParams.get('transactionId') || '';
  const referenceNumber = searchParams.get('ref') || '';
  const [categoryData, setCategoryData] = useState<{title: string; icon_url: string | null} | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Load category data with image preload
  useEffect(() => {
    const loadCategory = async () => {
      try {
        const { data } = await supabase
          .from('donation_categories')
          .select('title, icon_url')
          .eq('category_id', category)
          .maybeSingle();
        
        if (data) {
          // Preload image before showing
          if (data.icon_url) {
            const img = new Image();
            img.src = data.icon_url;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }
          setCategoryData(data);
        }
      } finally {
        setIsReady(true);
      }
    };
    loadCategory();
  }, [category]);

  // Silent countdown - no display but still redirects
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/kiosk');
    }, 10000);
    return () => clearTimeout(timer);
  }, [navigate]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  const handleSMSReceipt = () => {
    navigate(`/kiosk/mobile-number?category=${category}&amount=${amount}&ref=${referenceNumber}&transactionId=${transactionId}`);
  };

  const handleReturnHome = () => {
    navigate('/kiosk');
  };

  // Don't render until data is loaded to prevent flashing
  if (!isReady) {
    return (
      <KioskLayout showHomeButton={false}>
        <div className="w-full max-w-md mx-auto flex items-center justify-center min-h-[300px]">
          <div className="animate-pulse text-white/50">...</div>
        </div>
      </KioskLayout>
    );
  }

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-md mx-auto flex flex-col min-h-[calc(100vh-120px)] justify-between px-4">
        <div className="flex-1 flex flex-col justify-center">
          {/* Thank You Message */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-black">
              شكراً لكم
            </h1>
            <h2 className="text-xl font-semibold text-black/80 mt-2">
              تم قبول تبرعكم بنجاح
            </h2>
          </div>

          {/* Donation Summary - Fixed layout, no white boxes */}
          <div className="text-center space-y-4 mb-8">
            {/* Category with thumbnail - Fixed height */}
            <div className="min-h-[100px]">
              <div className="w-20 h-20 mx-auto rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-white/20">
                {categoryData?.icon_url && (
                  <img 
                    src={categoryData.icon_url} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-black/70 text-sm mb-1">نوع التبرع</p>
              <p className="text-xl font-semibold text-black min-h-[28px]">
                {categoryData?.title || ''}
              </p>
            </div>
            <div>
              <p className="text-black/70 text-sm mb-1">المبلغ المتبرع به</p>
              <p className="text-3xl font-bold text-emerald-700">
                {formatAmount(amount)}
              </p>
            </div>
          </div>

          {/* Receipt Option - No white box */}
          <div className="text-center space-y-3">
            <p className="text-lg font-semibold text-black">
              هل ترغب في الحصول على إيصال الدفع عبر رسالة نصية ؟
            </p>
            
            <KioskButton
              variant="confirm"
              size="lg"
              soundEffect="navigation"
              onClick={handleSMSReceipt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 px-12"
            >
              نعم
            </KioskButton>
          </div>
        </div>

        {/* Home Button at bottom center - icon only, white color */}
        <div className="flex justify-center pb-6">
          <KioskButton
            variant="ghost"
            size="icon"
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
