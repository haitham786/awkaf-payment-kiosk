import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
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

      // Embed Thawani checkout inside the kiosk app via iframe (handled in render).
      // Do not redirect the top-level window so the user stays inside the kiosk app.
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

  if (stage === 'creating') {
    // Keep the kiosk background visible (no black flash) while we create the
    // Thawani session. KioskLayout reads bg/logo from localStorage so it paints instantly.
    return <KioskLayout showHomeButton={false}>{null}</KioskLayout>;
  }

  if (stage === 'redirecting' && checkoutUrl) {
    const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
      // Try to read the iframe URL. Same-origin success/cancel URLs are readable;
      // cross-origin Thawani pages will throw and we ignore them.
      try {
        const href = e.currentTarget.contentWindow?.location?.href;
        if (!href) return;
        if (href.includes('/kiosk/thank-you') || href.includes('/kiosk/error')) {
          const url = new URL(href);
          navigate(url.pathname + url.search, { replace: true });
        }
      } catch {
        // cross-origin — Thawani page, ignore
      }
    };

    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-gray-900">الدفع الآمن عبر ثواني</span>
            <span className="text-[10px] text-gray-500">Secure payment via Thawani</span>
          </div>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 text-gray-700 hover:text-destructive px-3 py-1 rounded-md"
            aria-label="Cancel payment"
          >
            <X className="w-5 h-5" />
            <span className="text-xs font-semibold">إلغاء / Cancel</span>
          </button>
        </div>
        <iframe
          src={checkoutUrl}
          title="Thawani Checkout"
          className="flex-1 w-full border-0"
          allow="payment *; camera; clipboard-read; clipboard-write"
          onLoad={handleIframeLoad}
        />
      </div>
    );
  }

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


        {stage === 'error' && (
          <>
            <Card className="px-5 py-8 bg-white/50 backdrop-blur-sm shadow-sm text-center rounded-xl">
              <div className="space-y-5">
                <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full shadow-md flex items-center justify-center">
                  <X className="w-9 h-9 text-destructive" aria-hidden="true" />
                </div>
                <div className="leading-tight flex flex-col items-center">
                  <h2 className="text-2xl font-bold text-destructive tracking-normal">تعذر إتمام عملية الدفع</h2>
                  <p className="text-sm text-destructive/70 mt-1">Transaction Declined</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4 px-1 pt-2 items-stretch">
              <KioskButton
                variant="secondary"
                size="xl"
                onClick={handleCancel}
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
                onClick={handleRetry}
                className="h-auto min-h-[82px] px-8 py-5 bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 rounded-xl shadow-sm flex items-center justify-center"
              >
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-base font-bold text-gray-900 tracking-normal">المحاولة مرة أخرى</span>
                  <span className="text-xs font-normal text-gray-900 mt-1">Try Again</span>
                </span>
              </KioskButton>
            </div>
          </>
        )}
      </div>
    </KioskLayout>
  );
};

export default ThawaniGatewayPage;
