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
import { Wifi, WifiOff, AlertTriangle, Loader2 } from "lucide-react";
import { ThawaniTapCardScreen } from "@/components/kiosk/ThawaniTapCardScreen";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

type PaymentStage = 'waiting' | 'processing' | 'success' | 'declined' | 'error';

const NFCPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  
  const [stage, setStage] = useState<PaymentStage>('waiting');
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline());
  const [transactionResult, setTransactionResult] = useState<SoftPOSTransactionResult | null>(null);
  const [categoryData, setCategoryData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isNativeMode, setIsNativeMode] = useState(false);
  
  const transactionId = React.useMemo(() => crypto.randomUUID(), []);
  const kioskId = localStorage.getItem('kiosk_id') || "";
  const autoStartRef = React.useRef(false);

  useEffect(() => {
    const fetchCategory = async () => {
      const { data } = await supabase.from('donation_categories').select('*').eq('category_id', category).maybeSingle();
      setCategoryData(data);
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
    if (!kioskId) { setErrorMessage('Kiosk is not registered. Please set up the kiosk first.'); setStage('error'); return; }
    try {
      const config = await loadKioskSoftPosConfig(kioskId);
      if (!config) { setErrorMessage('Soft POS is not configured for this kiosk.'); setStage('error'); return; }
      const initialized = await initializeSoftPOS(config);
      if (!initialized) { setErrorMessage('Failed to initialize payment terminal.'); setStage('error'); return; }
      const status = getSoftPOSStatus();
      setIsNativeMode(status.isNativeAvailable);
      const nfcStatus = await checkNFCAvailability();
      if (!nfcStatus.isAvailable) { setErrorMessage('NFC is not available on this device.'); setStage('error'); return; }
      if (!nfcStatus.isEnabled) { setErrorMessage('NFC is disabled. Please enable NFC in device settings.'); setStage('error'); return; }
      onPaymentStart(() => setStage('processing'));
      onSoftPOSApproval((result) => { setTransactionResult(result); handlePaymentSuccess(result); });
      onSoftPOSFailure((error, errorCode) => { setStage('declined'); setTransactionResult({ success: false, error, errorCode }); });
      setStage('waiting');
    } catch (error: any) {
      console.error('Failed to initialize payment:', error);
      setErrorMessage(error.message || 'Failed to initialize payment terminal');
      setStage('error');
    }
  }, [kioskId]);

  useEffect(() => { initializePayment(); return () => { cancelTransaction(); }; }, [initializePayment]);

  const handlePaymentSuccess = async (result: SoftPOSTransactionResult) => {
    const status = getSoftPOSStatus();
    const transactionData = { transactionId, kioskId, amount, category, paymentResult: result, paymentType: 'soft_pos', provider: 'thawani', mode: status.mode === 'test' ? 'test' : 'live', thawaniReference: result.thawaniReference, createdAt: new Date().toISOString() };
    if (isOnline()) {
      try {
        const { data, error } = await supabase.functions.invoke('process-payment', { body: { transactionId, kioskId, amount, category, mobileNumber: null, softPosResult: result, paymentType: 'soft_pos', provider: 'thawani', thawaniReference: result.thawaniReference } });
        if (error) throw error;
        navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data.transaction?.reference_number || transactionId}&catRef=${categoryData?.category_reference || ''}`);
      } catch (error: any) {
        queueTransaction(transactionData);
        toast.info('Payment saved. Will sync when online.');
        navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&catRef=${categoryData?.category_reference || ''}`);
      }
    } else {
      queueTransaction(transactionData);
      toast.info('Payment saved offline. Will sync automatically.');
      navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&catRef=${categoryData?.category_reference || ''}`);
    }
  };

  const handleStartPayment = useCallback(async () => {
    setStage('processing');
    try {
      const result = await startSoftPOSTransaction(amount, transactionId, `Donation - ${category}`);
      if (result.success) { /* handled by callback */ }
      else if (result.errorCode !== 'USER_CANCELLED') { /* handled by callback */ }
      else { setStage('waiting'); }
    } catch (error: any) { setStage('declined'); setTransactionResult({ success: false, error: error.message }); }
  }, [amount, category, transactionId]);

  useEffect(() => {
    if (stage !== 'waiting') return;
    const status = getSoftPOSStatus();
    if (status.mode !== 'test') return;
    if (autoStartRef.current) return;
    autoStartRef.current = true;
    const t = window.setTimeout(() => { void handleStartPayment(); }, 900);
    return () => window.clearTimeout(t);
  }, [handleStartPayment, stage]);

  const handleTryAgain = () => { autoStartRef.current = false; setStage('waiting'); setTransactionResult(null); setErrorMessage(''); };
  const handleCancel = () => { cancelTransaction(); navigate('/kiosk'); };
  const handleTimeout = () => { cancelTransaction(); navigate('/kiosk'); };
  const handleRetrySetup = () => { setStage('waiting'); setErrorMessage(''); initializePayment(); };

  const formatAmountNum = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')}`;
  };

  const status = getSoftPOSStatus();
  const useFullScreenUI = status.mode === 'test' && ['waiting', 'processing'].includes(stage);

  if (useFullScreenUI) {
    return <ThawaniTapCardScreen amount={amount} category={category} stage={stage as 'waiting' | 'processing'} isTrialMode={true} onCancel={handleCancel} onTimeout={handleTimeout} />;
  }

  if (stage === 'error') {
    return (
      <KioskLayout showHomeButton={false}>
        <div className="w-full max-w-xl mx-auto space-y-3">
          <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-700">خطأ في النظام</h2>
                <p className="text-sm text-red-500">System Error</p>
                <p className="text-xs text-gray-600 mt-2">{errorMessage}</p>
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
      <KioskLayout showHomeButton={false}>
        <div className="w-full max-w-xl mx-auto space-y-3">
          <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-4xl">✕</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-700">تم رفض العملية</h2>
                <p className="text-sm text-red-500">Transaction Declined</p>
                {transactionResult?.error && <p className="text-xs text-gray-600 mt-2">{transactionResult.error}</p>}
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <KioskButton variant="confirm" size="sm" onClick={handleTryAgain}>
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
