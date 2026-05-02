import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  loadKioskSoftPosConfig, initializeSoftPOS, checkNFCAvailability,
  startSoftPOSTransaction, onPaymentStart, onSoftPOSApproval, onSoftPOSFailure,
  cancelTransaction, getSoftPOSStatus, SoftPOSTransactionResult,
} from "@/services/softPosService";
import { queueTransaction, isOnline } from "@/services/offlineQueueService";
import { Wifi, WifiOff, AlertTriangle, Loader2, X } from "lucide-react";
import { ThawaniTapCardScreen } from "@/components/kiosk/ThawaniTapCardScreen";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";
import { readCachedCategory, storeCategoryInCache } from "@/lib/kioskCategoryCache";

type PaymentStage = 'waiting' | 'processing' | 'success' | 'declined' | 'error';

const NFCPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  
  const [stage, setStage] = useState<PaymentStage>('waiting');
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline());
  const [transactionResult, setTransactionResult] = useState<SoftPOSTransactionResult | null>(null);
  const [categoryData, setCategoryData] = useState<any>(() => readCachedCategory(category));
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isNativeMode, setIsNativeMode] = useState(false);
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  
  const transactionId = React.useMemo(() => crypto.randomUUID(), []);
  const kioskId = localStorage.getItem('kiosk_id') || "";
  const autoStartRef = React.useRef(false);
  const paymentInFlightRef = React.useRef(false);

  useEffect(() => {
    const fetchCategory = async () => {
      const cached = readCachedCategory(category);
      if (cached) {
        setCategoryData(cached);
        return;
      }

      const { data } = await supabase.from('donation_categories').select('*').eq('category_id', category).maybeSingle();
      if (data) {
        storeCategoryInCache(data);
        setCategoryData(data);
      }
    };
    fetchCategory();
    const handleOnline = () => setIsOnlineStatus(true);
    const handleOffline = () => setIsOnlineStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [category]);

  const initializePayment = useCallback(async () => {
    setErrorMessage('');
    setIsPaymentReady(false);
    autoStartRef.current = false;
    paymentInFlightRef.current = false;
    if (!Number.isFinite(amount) || amount <= 0) { setErrorMessage('Invalid donation amount. Please select or enter an amount again.'); setStage('error'); return; }
    if (!kioskId) { setErrorMessage('Kiosk is not registered. Please set up the kiosk first.'); setStage('error'); return; }
    try {
      const config = await loadKioskSoftPosConfig(kioskId);
      if (!config) { setErrorMessage('Soft POS is not configured for this kiosk.'); setStage('error'); return; }
      const initialized = await initializeSoftPOS(config);
      if (!initialized) {
        setErrorMessage('Soft POS could not be initialized. Please rebuild the APK from GitHub Actions.');
        setStage('error');
        return;
      }
      const status = getSoftPOSStatus();
      setIsNativeMode(status.isNativeAvailable);
      const nfcStatus = await checkNFCAvailability();
      if (!nfcStatus.isAvailable) { setErrorMessage('NFC is not available on this device.'); setStage('error'); return; }
      if (!nfcStatus.isEnabled) { setErrorMessage('NFC is disabled. Please enable NFC in device settings.'); setStage('error'); return; }
      onPaymentStart(() => setStage('processing'));
      onSoftPOSApproval((result) => { setTransactionResult(result); handlePaymentSuccess(result); });
      onSoftPOSFailure((error, errorCode) => { setStage('declined'); setTransactionResult({ success: false, error, errorCode }); });
      setStage('waiting');
      setIsPaymentReady(true);
    } catch (error: any) {
      console.error('Failed to initialize payment:', error);
      const raw = error?.message || 'Failed to initialize payment terminal';
      let friendly = raw;
      if (/PLUGIN_NOT_REGISTERED/i.test(raw)) {
        friendly = 'Native Thawani plugin is not registered in this APK. Rebuild from GitHub Actions and reinstall.';
      } else if (/SDK_NOT_LOADABLE|ClassNotFound|NoClassDefFound/i.test(raw)) {
        friendly = 'Thawani Lamsa SDK is not bundled in this APK. Rebuild from GitHub Actions and reinstall.';
      }
      setErrorMessage(`${friendly}\n\nDetails: ${raw}`);
      setStage('error');
      setIsPaymentReady(false);
    }
  }, [amount, kioskId]);

  useEffect(() => { initializePayment(); return () => { cancelTransaction(); }; }, [initializePayment]);

  useEffect(() => {
    if (stage !== 'declined' && stage !== 'error') return;
    const timer = window.setTimeout(() => {
      cancelTransaction();
      navigate('/kiosk');
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [navigate, stage]);

  const handlePaymentSuccess = async (result: SoftPOSTransactionResult) => {
    paymentInFlightRef.current = false;
    const status = getSoftPOSStatus();
    const transactionData = { transactionId, kioskId, amount, category, paymentResult: result, paymentType: 'soft_pos', provider: 'thawani', mode: status.mode === 'test' ? 'test' : 'live', thawaniReference: result.thawaniReference, createdAt: new Date().toISOString() };
    if (isOnline()) {
      try {
        const { data, error } = await supabase.functions.invoke('process-payment', { body: { transactionId, kioskId, amount, category, mobileNumber: null, softPosResult: result, paymentType: 'soft_pos', provider: 'thawani', thawaniReference: result.thawaniReference } });
        if (error) throw error;
        navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data.transaction?.reference_number || transactionId}&transactionId=${transactionId}&paymentMethod=soft_pos&catRef=${categoryData?.category_reference || ''}`);
      } catch (error: any) {
        queueTransaction(transactionData);
        toast.info('Payment saved. Will sync when online.');
        navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&transactionId=${transactionId}&paymentMethod=soft_pos&catRef=${categoryData?.category_reference || ''}`);
      }
    } else {
      queueTransaction(transactionData);
      toast.info('Payment saved offline. Will sync automatically.');
      navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&transactionId=${transactionId}&paymentMethod=soft_pos&catRef=${categoryData?.category_reference || ''}`);
    }
  };

  const handleStartPayment = useCallback(async () => {
    if (paymentInFlightRef.current) return;
    paymentInFlightRef.current = true;
    setStage('processing');
    try {
      const result = await startSoftPOSTransaction(amount, transactionId, `Donation - ${category}`);
      paymentInFlightRef.current = false;
      if (result.success) { /* handled by callback */ }
      else { setStage('declined'); setTransactionResult(result); }
    } catch (error: any) {
      paymentInFlightRef.current = false;
      setStage('declined');
      setTransactionResult({ success: false, error: error.message || 'Payment launch failed', errorCode: 'PAYMENT_EXCEPTION' });
    }
  }, [amount, category, transactionId]);

  // Auto-launch payment as soon as we're ready.
  // - On native (Lamsa SDK present): hands off immediately to Thawani's official Activity.
  // - In simulation/test (web preview): triggers our simulated tap-card UI.
  useEffect(() => {
    if (stage !== 'waiting') return;
    if (!isPaymentReady) return;
    if (autoStartRef.current) return;
    autoStartRef.current = true;
    const status = getSoftPOSStatus();
    // Native: launch immediately so Thawani's UI takes the screen with no delay.
    // Simulation: tiny delay so the user sees the "waiting" UI for a beat.
    const delay = status.isNativeAvailable ? 0 : 900;
    const t = window.setTimeout(() => { void handleStartPayment(); }, delay);
    return () => window.clearTimeout(t);
  }, [handleStartPayment, isPaymentReady, stage]);

  const handleTryAgain = () => { autoStartRef.current = false; paymentInFlightRef.current = false; setStage('waiting'); setTransactionResult(null); setErrorMessage(''); };
  const handleCancel = () => { cancelTransaction(); navigate('/kiosk'); };
  const handleTimeout = () => { cancelTransaction(); navigate('/kiosk'); };
  const handleRetrySetup = () => { setStage('waiting'); setErrorMessage(''); setIsPaymentReady(false); initializePayment(); };

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const status = getSoftPOSStatus();
  // Show our custom Tap Card simulation ONLY in non-native (web preview) mode.
  // On native Android, the official Thawani Lamsa Activity takes over the screen,
  // so we must NOT draw a competing UI.
  const useFullScreenUI = !status.isNativeAvailable && status.mode === 'test' && ['waiting', 'processing'].includes(stage);

  if (useFullScreenUI) {
    return <ThawaniTapCardScreen amount={amount} category={category} stage={stage as 'waiting' | 'processing'} isTrialMode={true} onCancel={handleCancel} onTimeout={handleTimeout} />;
  }

  if (stage === 'error') {
    return (
      <KioskLayout>
        <div className="w-full max-w-xl mx-auto space-y-3">
          <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-700">خطأ في النظام</h2>
                <p className="text-sm text-red-500">System Error</p>
                <p className="text-xs text-gray-600 mt-2 whitespace-pre-line">{errorMessage}</p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <KioskButton variant="confirm" size="sm" onClick={handleRetrySetup}>
                  <span className="flex flex-col items-center"><span>حاول مرة أخرى</span><span className="text-[0.6rem] opacity-80">Try Again</span></span>
                </KioskButton>
                <KioskButton variant="secondary" size="sm" onClick={handleCancel}>
                  <span className="flex flex-col items-center"><span>إلغاء</span><span className="text-[0.6rem] opacity-80">Cancel</span></span>
                </KioskButton>
              </div>
            </div>
          </Card>
        </div>
      </KioskLayout>
    );
  }

  if (stage === 'declined') {
    return (
      <KioskLayout>
        <div className="w-full max-w-md mx-auto flex flex-col justify-center gap-3 pb-24">
          <Card className="px-5 py-8 bg-white/50 backdrop-blur-sm shadow-sm border-2 border-destructive/45 text-center rounded-xl">
            <div className="space-y-5">
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full shadow-md flex items-center justify-center border-2 border-destructive/45">
                <X className="w-9 h-9 text-destructive" aria-hidden="true" />
              </div>
              <div className="leading-tight flex flex-col items-center">
                <h2 className="text-2xl font-bold text-destructive tracking-normal">تم رفض العملية</h2>
                <p className="text-sm text-destructive/70 mt-1">Transaction Declined</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 px-1 pt-2 items-stretch">
            <KioskButton
              variant="secondary"
              size="xl"
              onClick={handleCancel}
              className="h-auto min-h-[82px] px-8 py-5 bg-white/50 hover:bg-white/70 bg-none backdrop-blur-sm text-gray-900 border-0 rounded-xl shadow-sm flex items-center justify-center"
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="text-base font-bold tracking-normal">إلغاء</span>
                <span className="text-xs font-normal text-gray-500 mt-1">Cancel</span>
              </span>
            </KioskButton>
            <KioskButton
              variant="secondary"
              size="xl"
              onClick={handleTryAgain}
              className="h-auto min-h-[82px] px-8 py-5 bg-white/50 hover:bg-white/70 bg-none backdrop-blur-sm text-gray-900 border-0 rounded-xl shadow-sm flex items-center justify-center"
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="text-base font-bold tracking-normal">المحاولة مرة أخرى</span>
                <span className="text-xs font-normal text-gray-500 mt-1">Try Again</span>
              </span>
            </KioskButton>
          </div>
        </div>
      </KioskLayout>
    );
  }

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-xl mx-auto space-y-3">
        <div className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-full text-xs font-medium ${isOnlineStatus ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {isOnlineStatus ? (<><Wifi className="w-3 h-3" /><span>Online</span></>) : (<><WifiOff className="w-3 h-3" /><span>Offline Mode</span></>)}
        </div>
        <Card className="p-3 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
          <p className="text-sm text-gray-600 mb-0.5">المبلغ <span className="text-xs text-gray-400">Amount</span></p>
          <p className="text-2xl font-bold text-emerald-700 flex items-center justify-center gap-2">
            <CurrencyLogo className="h-5" />
            {formatAmountNum(amount)}
          </p>
        </Card>
        <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
          <Loader2 className="w-16 h-16 mx-auto text-emerald-600 animate-spin" />
          <h2 className="text-xl font-bold text-gray-900 mt-4">جاري التحميل...</h2>
          <p className="text-sm text-gray-500">Loading...</p>
        </Card>
      </div>
    </KioskLayout>
  );
};

export default NFCPaymentPage;
