import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

const ThawaniGatewayPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');

  const [stage, setStage] = useState<'creating' | 'redirecting' | 'error'>('creating');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [categoryData, setCategoryData] = useState<any>(null);

  const transactionId = React.useMemo(() => crypto.randomUUID(), []);
  const kioskId = localStorage.getItem('kiosk_id') || "";

  useEffect(() => {
    const cached = sessionStorage.getItem(`category_${category}`);
    if (cached) setCategoryData(JSON.parse(cached));
    else {
      supabase.from('donation_categories').select('title, title_en, icon_url, category_reference').eq('category_id', category).maybeSingle()
        .then(({ data }) => { if (data) { sessionStorage.setItem(`category_${category}`, JSON.stringify(data)); setCategoryData(data); } });
    }
  }, [category]);

  const createSession = useCallback(async () => {
    if (!kioskId) { setErrorMessage('Kiosk is not registered.'); setStage('error'); return; }

    try {
      setStage('creating');

      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke('thawani-checkout', {
        body: {
          action: 'create_session',
          amount,
          category,
          transactionId,
          kioskId,
          categoryReference: categoryData?.category_reference || '',
          successUrl: `${origin}/kiosk/thank-you?category=${category}&amount=${amount}&transactionId=${transactionId}&paymentMethod=gateway&catRef=${categoryData?.category_reference || ''}`,
          cancelUrl: `${origin}/kiosk/error?category=${category}&amount=${amount}`,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create session');

      setCheckoutUrl(data.checkout_url);
      setStage('redirecting');

      // Open Thawani checkout in same window
      window.location.href = data.checkout_url;
    } catch (err: any) {
      console.error('Thawani session error:', err);
      setErrorMessage(err.message || 'Failed to create payment session');
      setStage('error');
    }
  }, [kioskId, amount, category, transactionId, categoryData]);

  useEffect(() => {
    createSession();
  }, [createSession]);

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const handleCancel = () => navigate('/kiosk');
  const handleRetry = () => { setStage('creating'); setErrorMessage(''); createSession(); };

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
