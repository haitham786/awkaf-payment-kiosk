import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";

const PENDING_GATEWAY_KEY = "kiosk_pending_gateway_payment";

const readPendingGatewayPayment = () =>
  sessionStorage.getItem(PENDING_GATEWAY_KEY) || localStorage.getItem(PENDING_GATEWAY_KEY);

const savePendingGatewayPayment = (value: string) => {
  sessionStorage.setItem(PENDING_GATEWAY_KEY, value);
  localStorage.setItem(PENDING_GATEWAY_KEY, value);
};

const clearPendingGatewayPayment = () => {
  sessionStorage.removeItem(PENDING_GATEWAY_KEY);
  localStorage.removeItem(PENDING_GATEWAY_KEY);
};

const ThawaniGatewayPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const retryToken = searchParams.get('retry') || '';

  const gatewayReturnState = React.useMemo<'none' | 'success' | 'failure'>(() => {
    const rawStatus = [
      searchParams.get('status'),
      searchParams.get('payment_status'),
      searchParams.get('paymentStatus'),
      searchParams.get('result'),
      searchParams.get('state'),
    ].filter(Boolean).join(' ').toLowerCase();

    if (
      searchParams.get('success') === 'true' ||
      /paid|success|successful|completed/.test(rawStatus)
    ) return 'success';

    if (
      searchParams.get('success') === 'false' ||
      searchParams.get('cancelled') === 'true' ||
      searchParams.get('canceled') === 'true' ||
      /cancel|fail|declin|reject|error/.test(rawStatus)
    ) return 'failure';

    return 'none';
  }, [searchParams]);

  const [stage, setStage] = useState<'creating' | 'redirecting' | 'error'>('creating');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [categoryData, setCategoryData] = useState<any>(null);
  const [gatewayMode, setGatewayMode] = useState<'test' | 'live'>('test');
  const [gatewayConfigReady, setGatewayConfigReady] = useState(false);
  const sessionStartedRef = React.useRef(false);

  const transactionId = React.useMemo(() => crypto.randomUUID(), []);
  const kioskId = localStorage.getItem('kiosk_id') || "";

  useEffect(() => {
    const cached = readCachedCategory(category);
    if (cached) setCategoryData(cached);
    else {
      supabase.from('donation_categories').select('title, title_en, icon_url, category_reference').eq('category_id', category).maybeSingle()
        .then(({ data }) => { if (data) { storeCategoryInCache({ ...data, category_id: category }); setCategoryData(data); } });
    }
  }, [category]);

  useEffect(() => {
    const loadGatewayMode = async () => {
      if (!kioskId) { setGatewayConfigReady(true); return; }

      try {
        const { data } = await supabase
          .from('kiosks')
          .select('configuration')
          .eq('id', kioskId)
          .maybeSingle();

        const config = data?.configuration as any;
        setGatewayMode(config?.payment_gateway?.mode === 'live' ? 'live' : 'test');
      } catch (error) {
        console.error('Error loading gateway mode:', error);
      } finally {
        setGatewayConfigReady(true);
      }
    };

    loadGatewayMode();
  }, [kioskId]);

  const createSession = useCallback(async () => {
    if (gatewayReturnState !== 'none') return;
    if (!kioskId) { setErrorMessage('Kiosk is not registered.'); setStage('error'); return; }
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;

    try {
      setStage('creating');

      const pendingPayment = readPendingGatewayPayment();
      if (pendingPayment && !retryToken) {
        const pending = JSON.parse(pendingPayment);
        if (pending?.category === category && Number(pending?.amount) === amount) {
          try {
            const { data } = await supabase.functions.invoke('thawani-checkout', {
              body: { action: 'check_session', transactionId: pending?.transactionId, gatewayMode: pending?.gatewayMode },
            });

            if (data?.payment_completed || data?.already_completed) {
              navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&transactionId=${pending?.transactionId}&paymentMethod=gateway&gatewayMode=${pending?.gatewayMode || gatewayMode}&catRef=${categoryData?.category_reference || ''}`, { replace: true });
            } else {
              navigate(`/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`, { replace: true });
            }
          } catch {
            navigate(`/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`, { replace: true });
          }
          return;
        }
      }

      if (retryToken) {
        clearPendingGatewayPayment();
      }

      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke('thawani-checkout', {
        body: {
          action: 'create_session',
          amount,
          category,
          transactionId,
          kioskId,
          gatewayMode,
          categoryReference: categoryData?.category_reference || '',
          successUrl: `${origin}/kiosk/thank-you?category=${category}&amount=${amount}&transactionId=${transactionId}&paymentMethod=gateway&gatewayMode=${gatewayMode}&catRef=${categoryData?.category_reference || ''}`,
          cancelUrl: `${origin}/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create session');

      setCheckoutUrl(data.checkout_url);
      setStage('redirecting');

      savePendingGatewayPayment(JSON.stringify({
        category,
        amount,
        transactionId,
        gatewayMode: data.gateway_mode || gatewayMode,
        checkoutUrl: data.checkout_url,
        createdAt: Date.now(),
      }));

      // Open Thawani checkout in the same window without keeping this loading page in history.
      window.location.replace(data.checkout_url);
    } catch (err: any) {
      sessionStartedRef.current = false;
      console.error('Thawani session error:', err);
      setErrorMessage(err.message || 'Failed to create payment session. Please verify the gateway environment and API keys.');
      setStage('error');
    }
  }, [kioskId, amount, category, transactionId, categoryData, gatewayMode, navigate, retryToken, gatewayReturnState]);

  useEffect(() => {
    if (gatewayReturnState === 'none') return;

    const pendingPayment = readPendingGatewayPayment();
    let pending: any = null;
    try {
      pending = pendingPayment ? JSON.parse(pendingPayment) : null;
    } catch {
      clearPendingGatewayPayment();
    }

    if (gatewayReturnState === 'success') {
      navigate(
        `/kiosk/thank-you?category=${category}&amount=${amount}&transactionId=${pending?.transactionId || transactionId}&paymentMethod=gateway&gatewayMode=${pending?.gatewayMode || gatewayMode}&catRef=${categoryData?.category_reference || ''}`,
        { replace: true }
      );
      return;
    }

    navigate(`/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`, { replace: true });
  }, [amount, category, categoryData, gatewayMode, gatewayReturnState, navigate, transactionId]);

  useEffect(() => {
    if (!gatewayConfigReady) return;
    createSession();
  }, [createSession, gatewayConfigReady]);

  useEffect(() => {
    const handleGatewayReturn = async () => {
      const pendingPayment = readPendingGatewayPayment();
      if (!pendingPayment) return;

      try {
        const pending = JSON.parse(pendingPayment);
        const returnedFromCheckout = Date.now() - Number(pending?.createdAt || 0) > 1500;
        if (returnedFromCheckout && pending?.category === category && Number(pending?.amount) === amount) {
          const { data } = await supabase.functions.invoke('thawani-checkout', {
            body: { action: 'check_session', transactionId: pending?.transactionId, gatewayMode: pending?.gatewayMode },
          });

          if (data?.payment_completed || data?.already_completed) {
            navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&transactionId=${pending?.transactionId}&paymentMethod=gateway&gatewayMode=${pending?.gatewayMode || gatewayMode}&catRef=${categoryData?.category_reference || ''}`, { replace: true });
          } else {
            navigate(`/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`, { replace: true });
          }
        }
      } catch {
        navigate(`/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`, { replace: true });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleGatewayReturn();
    };

    window.addEventListener('pageshow', handleGatewayReturn);
    window.addEventListener('focus', handleGatewayReturn);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pageshow', handleGatewayReturn);
      window.removeEventListener('focus', handleGatewayReturn);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [amount, category, categoryData, gatewayMode, navigate]);

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const handleCancel = () => navigate('/kiosk');
  const handleRetry = () => { sessionStartedRef.current = false; setStage('creating'); setErrorMessage(''); createSession(); };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-xl mx-auto space-y-4">
        <Card className="p-4 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
          <p className="text-sm text-gray-600 mb-0.5">المبلغ <span className="text-xs text-gray-400">Amount</span></p>
          <p className="text-2xl font-bold text-emerald-700 flex items-center justify-center gap-2">
            <CurrencyLogo className="h-5" />
            {formatAmountNum(amount)}
          </p>
        </Card>

        {(stage === 'creating' || stage === 'redirecting') && (
          <Card className="p-8 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 mx-auto text-emerald-600 animate-spin" />
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {stage === 'creating' ? 'جاري إنشاء جلسة الدفع...' : 'جاري التحويل إلى صفحة الدفع...'}
                </h2>
                <p className="text-sm text-gray-500">
                  {stage === 'creating' ? 'Creating payment session...' : 'Redirecting to payment page...'}
                </p>
              </div>
              {stage === 'redirecting' && checkoutUrl && (
                <div className="pt-4">
                  <a
                    href={checkoutUrl}
                    className="inline-flex items-center gap-2 text-emerald-600 underline text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Click here if not redirected
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {stage === 'error' && (
          <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-4xl">✕</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-700">خطأ في الدفع</h2>
                <p className="text-sm text-red-500">Payment Error</p>
                <p className="text-xs text-gray-600 mt-2">{errorMessage}</p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <KioskButton variant="confirm" size="sm" onClick={handleRetry}>
                  <span className="flex flex-col items-center">
                    <span>حاول مرة أخرى</span>
                    <span className="text-[0.6rem] opacity-80">Try Again</span>
                  </span>
                </KioskButton>
                <KioskButton variant="secondary" size="sm" onClick={handleCancel}>
                  <span className="flex flex-col items-center">
                    <span>إلغاء</span>
                    <span className="text-[0.6rem] opacity-80">Cancel</span>
                  </span>
                </KioskButton>
              </div>
            </div>
          </Card>
        )}
      </div>
    </KioskLayout>
  );
};

export default ThawaniGatewayPage;
