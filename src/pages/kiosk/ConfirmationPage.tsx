import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Cache for preloaded images
const imageCache = new Map<string, boolean>();

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [categoryData, setCategoryData] = useState<{title: string; icon_url: string | null} | null>(() => {
    // Try to get from sessionStorage for instant display
    const cached = sessionStorage.getItem(`category_${category}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  });
  const [isReady, setIsReady] = useState(() => {
    // If we have cached data, we're ready immediately
    return !!sessionStorage.getItem(`category_${category}`);
  });

  useEffect(() => {
    const loadCategory = async () => {
      // Check if already in cache
      const cached = sessionStorage.getItem(`category_${category}`);
      if (cached) {
        setCategoryData(JSON.parse(cached));
        setIsReady(true);
        return;
      }

      const { data, error } = await supabase
        .from('donation_categories')
        .select('title, icon_url')
        .eq('category_id', category)
        .maybeSingle();
      
      if (data) {
        // Cache the data
        sessionStorage.setItem(`category_${category}`, JSON.stringify(data));
        
        // Preload the image before setting data to prevent flash
        if (data.icon_url && !imageCache.has(data.icon_url)) {
          const img = new Image();
          img.onload = () => {
            imageCache.set(data.icon_url!, true);
            setCategoryData(data);
            setIsReady(true);
          };
          img.onerror = () => {
            imageCache.set(data.icon_url!, false);
            setCategoryData(data);
            setIsReady(true);
          };
          img.src = data.icon_url;
        } else {
          setCategoryData(data);
          setIsReady(true);
        }
      } else {
        setIsReady(true);
      }
    };
    
    loadCategory();
  }, [category]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  const handleConfirm = async () => {
    // Check if kiosk is configured for Soft POS
    const kioskId = localStorage.getItem('kiosk_id');
    if (kioskId) {
      try {
        const { data: kioskData } = await supabase
          .from('kiosks')
          .select('configuration')
          .eq('id', kioskId)
          .maybeSingle();
        
        const config = kioskData?.configuration as any;
        if (config?.payment_mode === 'soft_pos') {
          // Go directly to NFC payment page for Soft POS
          navigate(`/kiosk/nfc-payment?category=${category}&amount=${amount}`);
          return;
        }
      } catch (error) {
        console.error('Error checking kiosk config:', error);
      }
    }
    
    // Default to payment request page for Hardware POS
    navigate(`/kiosk/payment-request?category=${category}&amount=${amount}`);
  };

  const handleBack = () => {
    navigate(`/kiosk/amount?category=${category}`);
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto">
        {/* Header - Black title as requested */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 drop-shadow-lg">
            تأكيد المبلغ
          </h1>
        </div>

        {/* Confirmation Card */}
        <Card className="p-6 bg-white/60 backdrop-blur-sm shadow-lg border-0 text-center">
          <div className="space-y-4">
            {/* Icon - Fixed height container for stability */}
            <div className="w-20 h-20 mx-auto rounded-full shadow-md flex items-center justify-center p-1">
              {categoryData?.icon_url && isReady && (
                <img src={categoryData.icon_url} alt="" className="w-full h-full object-contain" />
              )}
            </div>

            {/* Donation Details */}
            <div className="space-y-3">
              <div className="bg-gray-50/60 rounded-lg p-4 border-0">
                <p className="text-sm text-gray-600 mb-1">نوع التبرع</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {categoryData?.title || 'تبرع'}
                </p>
              </div>

              <div className="bg-emerald-50/60 rounded-lg p-4 border-0">
                <p className="text-sm text-gray-600 mb-1">مبلغ التبرع</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {formatAmount(amount)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-4 pb-20">
          <KioskButton
            variant="outline"
            size="xl"
            soundEffect="navigation"
            onClick={handleBack}
            className="min-w-[160px] ml-4 bg-white/60 backdrop-blur-sm border-0 hover:bg-gray-100/60 text-gray-900"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            تعديل المبلغ
          </KioskButton>
          
          <KioskButton
            variant="confirm"
            size="xl"
            soundEffect="navigation"
            onClick={handleConfirm}
            className="min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          >
            تأكيد والدفع
            <ArrowLeft className="w-5 h-5 mr-2" />
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ConfirmationPage;
