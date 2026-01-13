import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const transactionId = searchParams.get('transactionId') || '';
  const referenceNumber = searchParams.get('ref') || '';
  const [countdown, setCountdown] = useState(10);
  const [categoryData, setCategoryData] = useState<{title: string; icon_url: string | null} | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load category data
  useEffect(() => {
    const loadCategory = async () => {
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

  // Auto-return timer (hidden from UI but functional)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/kiosk');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
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

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[70vh]">
        {/* Success Card - No icons, simplified */}
        <Card className="p-6 bg-white/60 backdrop-blur-sm shadow-lg border-0 text-center w-full max-w-md">
          <div className="space-y-4">
            {/* Thank You Message - No exclamation mark */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-emerald-700">
                شكرا لكم
              </h1>
              <h2 className="text-xl font-semibold text-gray-900">
                تم قبول تبرعكم بنجاح
              </h2>
            </div>

            {/* Category Thumbnail and Title */}
            <div className="flex flex-col items-center justify-center gap-2 min-h-[80px]">
              {categoryData?.icon_url && imageLoaded && (
                <div className="w-16 h-16">
                  <img 
                    src={categoryData.icon_url} 
                    alt={categoryData.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <p className="text-lg font-semibold text-gray-900">
                {categoryData?.title || 'تبرع'}
              </p>
            </div>

            {/* Amount - No frame/box */}
            <div className="py-2">
              <p className="text-3xl font-bold text-emerald-700">
                {formatAmount(amount)}
              </p>
            </div>
          </div>
        </Card>

        {/* SMS Receipt Question - Simplified with only "Yes" button in Arabic */}
        <div className="mt-6 text-center space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            هل تريد إيصال عبر الرسائل النصية؟
          </h3>
          
          <KioskButton
            variant="confirm"
            size="xl"
            soundEffect="navigation"
            onClick={handleSMSReceipt}
            className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          >
            نعم
          </KioskButton>
        </div>

        {/* Home Button - Centered at bottom, matching style with other pages */}
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
