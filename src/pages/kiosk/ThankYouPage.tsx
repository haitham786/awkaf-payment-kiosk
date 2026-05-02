import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Home, Loader2 } from "lucide-react";
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
  const [referenceNumber, setReferenceNumber] = useState(searchParams.get('ref') || '');
  const [_countdown, setCountdown] = useState(10);
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
    navigate(`/kiosk/mobile-number?category=${category}&amount=${amount}&ref=${referenceNumber}&transactionId=${transactionId}`);
  };

  const handleReturnHome = () => { navigate('/kiosk'); };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[70vh]">
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
          </>
        )}
      </div>
    </KioskLayout>
  );
};

export default ThankYouPage;
