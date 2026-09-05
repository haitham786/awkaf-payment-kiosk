import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";

const imageCache = new Map<string, boolean>();
const PENDING_GATEWAY_KEY = "kiosk_pending_gateway_payment";

const ThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const transactionId = searchParams.get('transactionId') || '';
  const paymentMethod = searchParams.get('paymentMethod') || '';
  const gatewayMode = searchParams.get('gatewayMode') || undefined;
  const posReference = searchParams.get('posRef') || '';
  const [referenceNumber, setReferenceNumber] = useState(searchParams.get('ref') || '');
  const [_countdown, setCountdown] = useState(15);
  const [verifying, setVerifying] = useState(false);
  const [categoryData, setCategoryData] = useState<{title: string; title_en: string | null; icon_url: string | null} | null>(() => readCachedCategory(category));
  const [isReady, setIsReady] = useState(() => !!readCachedCategory(category));

  // Load category data
  useEffect(() => {
    const loadCategory = async () => {
      const cached = readCachedCategory(category);
      if (cached) { setCategoryData(cached); setIsReady(true); return; }
      const { data } = await supabase.from('donation_categories').select('title, title_en, icon_url').eq('category_id', category).maybeSingle();
      if (data) {
        storeCategoryInCache({ ...data, category_id: category });
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

  // For payment gateway: verify payment and get system reference
  useEffect(() => {
    if (paymentMethod !== 'gateway' || !transactionId) return;
    let cancelled = false;

    const verifyGatewayPayment = async () => {
      setVerifying(true);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const { data, error } = await supabase.functions.invoke('thawani-checkout', {
            body: { action: 'check_session', transactionId, gatewayMode },
          });

          if (cancelled) return;

          if (error) {
            console.error('Gateway verification error:', error);
          } else if (data?.payment_completed || data?.already_completed) {
            if (data.transaction?.reference_number) {
              setReferenceNumber(data.transaction.reference_number);
            }
            sessionStorage.removeItem(PENDING_GATEWAY_KEY);
            localStorage.removeItem(PENDING_GATEWAY_KEY);
            setVerifying(false);
            return;
          }
        } catch (err) {
          console.error('Gateway verification failed:', err);
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!cancelled) {
        setVerifying(false);
        navigate(`/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`);
      }
    };

    verifyGatewayPayment();
    return () => { cancelled = true; };
  }, [paymentMethod, transactionId, gatewayMode, navigate, category, amount]);

  // Countdown timer
  useEffect(() => {
    if (verifying) return; // Don't start countdown until verification is done
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); navigate('/kiosk'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate, verifying]);

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const handleSMSReceipt = () => {
    navigate(
      `/kiosk/mobile-number?category=${category}&amount=${amount}` +
        `&ref=${encodeURIComponent(referenceNumber)}` +
        `&posRef=${encodeURIComponent(posReference)}` +
        `&transactionId=${transactionId}`,
    );
  };

  return (
    <KioskLayout>
      <div className="w-[90%] max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[62vh] pb-20">
        {verifying ? (
          <Card className="p-6 bg-white/60 backdrop-blur-sm shadow-lg border-0 text-center w-full max-w-md">
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 mx-auto text-emerald-600 animate-spin" />
              <h2 className="text-xl font-bold text-gray-900">جاري التحقق من الدفع...</h2>
              <p className="text-sm text-gray-500">Verifying payment...</p>
            </div>
          </Card>
        ) : (
          <>
            <Card className="px-5 py-2.5 bg-white/60 backdrop-blur-sm shadow-lg border-0 text-center w-full max-w-sm">
              <div className="space-y-1.5">
                <div className="space-y-0.5">
                  <h1 className="text-3xl font-bold text-emerald-700">شكرا لكم</h1>
                  <p className="text-lg text-emerald-700">Thank You</p>
                  <h2 className="text-xl font-semibold text-gray-900">تم قبول تبرعكم بنجاح</h2>
                  <p className="text-xs text-gray-900 whitespace-nowrap">Your Donation has been accepted</p>
                </div>

                <div className="flex flex-col items-center justify-center gap-0.5 min-h-[56px]">
                  <div className="w-12 h-12 flex items-center justify-center">
                    {categoryData?.icon_url && isReady && (
                      <img src={categoryData.icon_url} alt={categoryData.title} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <p className="text-base font-semibold text-gray-900">{categoryData?.title || 'تبرع'}</p>
                  {categoryData?.title_en && (
                    <p className="text-xs text-gray-900">{categoryData.title_en}</p>
                  )}
                </div>

                <div>
                  <p className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
                    <CurrencyLogo className="h-5" />
                    {formatAmountNum(amount)}
                  </p>
                </div>
              </div>
            </Card>

             <div className="mt-2 text-center space-y-2">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-gray-900">هل تريد إيصال عبر الرسائل النصية؟</h3>
                <p className="text-xs text-gray-900 whitespace-nowrap">Would you like to receive a receipt via SMS?</p>
              </div>
              
              <div className="flex justify-center">
                <KioskButton
                  variant="secondary"
                  size="sm"
                  soundEffect="navigation"
                  onClick={handleSMSReceipt}
                  className="h-10 px-8 py-1 text-xs font-bold bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 flex flex-col items-center justify-center gap-0 rounded-xl"
                >
                  <span className="text-sm">نعم</span>
                  <span className="text-gray-900">Yes</span>
                </KioskButton>
              </div>
            </div>

          </>
        )}
      </div>
    </KioskLayout>
  );
};

export default ThankYouPage;
