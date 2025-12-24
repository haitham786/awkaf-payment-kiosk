import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  loadKioskSoftPosConfig,
  initializeSoftPOS,
  checkNFCAvailability,
  validatePaymentReadiness,
  startSoftPOSTransaction,
  onPaymentStart,
  onSoftPOSApproval,
  onSoftPOSFailure,
  cancelTransaction,
  getSoftPOSStatus,
  SoftPOSTransactionResult,
} from "@/services/softPosService";
import { queueTransaction, isOnline } from "@/services/offlineQueueService";
import { Wifi, WifiOff, CreditCard, AlertTriangle, Smartphone, Loader2 } from "lucide-react";

type PaymentStage = 'initializing' | 'nfc_check' | 'waiting' | 'processing' | 'success' | 'declined' | 'error';

const NFCPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  
  const [stage, setStage] = useState<PaymentStage>('initializing');
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline());
  const [transactionResult, setTransactionResult] = useState<SoftPOSTransactionResult | null>(null);
  const [categoryData, setCategoryData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isNativeMode, setIsNativeMode] = useState(false);
  const [initLogs, setInitLogs] = useState<string[]>([]);
  
  const transactionId = React.useMemo(() => crypto.randomUUID(), []);
  const kioskId = localStorage.getItem('kiosk_id') || "";

  const addLog = (message: string) => {
    console.log(`[NFCPayment] ${message}`);
    setInitLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    // Fetch category data
    const fetchCategory = async () => {
      const { data } = await supabase
        .from('donation_categories')
        .select('*')
        .eq('category_id', category)
        .maybeSingle();
      setCategoryData(data);
    };
    fetchCategory();

    // Monitor online status
    const handleOnline = () => setIsOnlineStatus(true);
    const handleOffline = () => setIsOnlineStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [category]);

  const initializePayment = useCallback(async () => {
    addLog('Starting payment initialization...');
    setStage('initializing');
    setErrorMessage('');
    
    if (!kioskId) {
      addLog('ERROR: No kiosk ID found');
      setErrorMessage('Kiosk is not registered. Please set up the kiosk first.');
      setStage('error');
      return;
    }

    try {
      // Load kiosk-specific Soft POS config
      addLog(`Loading Soft POS config for kiosk: ${kioskId}`);
      const config = await loadKioskSoftPosConfig(kioskId);
      
      if (!config) {
        addLog('ERROR: No Soft POS configuration found');
        setErrorMessage('Soft POS is not configured for this kiosk. Please configure Thawani settings in the admin panel.');
        setStage('error');
        return;
      }
      
      addLog(`Config loaded: environment=${config.environment}, hasToken=${!!config.tajerToken}`);
      
      // Initialize the SDK
      addLog('Initializing Thawani Lamsa SDK...');
      const initialized = await initializeSoftPOS(config);
      
      if (!initialized) {
        addLog('ERROR: SDK initialization failed');
        setErrorMessage('Failed to initialize Thawani payment terminal.');
        setStage('error');
        return;
      }
      
      addLog('SDK initialized successfully');
      
      // Check if running in native mode
      const status = getSoftPOSStatus();
      setIsNativeMode(status.isNativeAvailable);
      addLog(`Mode: ${status.isNativeAvailable ? 'NATIVE ANDROID' : 'WEB SIMULATION'}`);
      
      // Check NFC status
      addLog('Checking NFC availability...');
      setStage('nfc_check');
      
      const nfcStatus = await checkNFCAvailability();
      addLog(`NFC status: available=${nfcStatus.isAvailable}, enabled=${nfcStatus.isEnabled}`);
      
      if (!nfcStatus.isAvailable) {
        addLog('ERROR: NFC hardware not available');
        setErrorMessage('NFC is not available on this device. Soft POS requires NFC capability.');
        setStage('error');
        return;
      }
      
      if (!nfcStatus.isEnabled) {
        addLog('WARNING: NFC is disabled');
        setErrorMessage('NFC is disabled. Please enable NFC in device settings to accept card payments.');
        setStage('error');
        return;
      }
      
      addLog('NFC check passed - ready for payment');
      
      // Register callbacks
      onPaymentStart(() => {
        addLog('Payment activity started');
        setStage('processing');
      });

      onSoftPOSApproval((result) => {
        addLog(`Payment approved: ref=${result.thawaniReference}`);
        setTransactionResult(result);
        handlePaymentSuccess(result);
      });

      onSoftPOSFailure((error, errorCode) => {
        addLog(`Payment failed: ${errorCode} - ${error}`);
        setStage('declined');
        setTransactionResult({ success: false, error, errorCode });
      });

      // Ready for payment
      setStage('waiting');
      addLog('Ready for payment - waiting for user action');
      
    } catch (error: any) {
      addLog(`ERROR: ${error.message}`);
      console.error('Failed to initialize payment:', error);
      setErrorMessage(error.message || 'Failed to initialize payment terminal');
      setStage('error');
    }
  }, [kioskId]);

  useEffect(() => {
    initializePayment();

    return () => {
      cancelTransaction();
    };
  }, [initializePayment]);

  const handlePaymentSuccess = async (result: SoftPOSTransactionResult) => {
    setStage('success');
    addLog('Processing successful payment...');

    const transactionData = {
      transactionId,
      kioskId,
      amount,
      category,
      paymentResult: result,
      paymentType: 'soft_pos',
      provider: 'thawani',
      mode: 'trial',
      thawaniReference: result.thawaniReference,
      createdAt: new Date().toISOString(),
    };

    if (isOnline()) {
      try {
        addLog('Sending to server...');
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            transactionId,
            kioskId,
            amount,
            category,
            mobileNumber: null,
            softPosResult: result,
            paymentType: 'soft_pos',
            provider: 'thawani',
            thawaniReference: result.thawaniReference,
          },
        });

        if (error) throw error;
        addLog('Payment recorded successfully');

        setTimeout(() => {
          navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data.transaction?.reference_number || transactionId}&catRef=${categoryData?.category_reference || ''}`);
        }, 2000);
      } catch (error: any) {
        addLog(`Server error: ${error.message} - queuing for later`);
        queueTransaction(transactionData);
        toast.info('Payment saved. Will sync when online.');
        setTimeout(() => {
          navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&catRef=${categoryData?.category_reference || ''}`);
        }, 2000);
      }
    } else {
      addLog('Offline - queuing transaction');
      queueTransaction(transactionData);
      toast.info('Payment saved offline. Will sync automatically.');
      setTimeout(() => {
        navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&catRef=${categoryData?.category_reference || ''}`);
      }, 2000);
    }
  };

  const handleStartPayment = async () => {
    addLog('User initiated payment - launching Thawani SDK...');
    setStage('processing');
    
    try {
      const result = await startSoftPOSTransaction(
        amount,
        transactionId,
        `Donation - ${category}`
      );
      
      if (result.success) {
        // Success is handled by callback
        addLog('Payment completed successfully');
      } else if (result.errorCode !== 'USER_CANCELLED') {
        // Failure is handled by callback (except user cancellation which we handle here)
        addLog(`Payment result: ${result.error}`);
      } else {
        addLog('User cancelled payment');
        setStage('waiting');
      }
    } catch (error: any) {
      addLog(`Payment error: ${error.message}`);
      setStage('declined');
      setTransactionResult({ success: false, error: error.message });
    }
  };

  const handleTryAgain = () => {
    setStage('waiting');
    setTransactionResult(null);
    setErrorMessage('');
  };

  const handleCancel = () => {
    cancelTransaction();
    navigate(`/kiosk/amount?category=${category}`);
  };

  const handleRetrySetup = () => {
    setStage('initializing');
    setErrorMessage('');
    initializePayment();
  };

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-xl mx-auto space-y-3">
        {/* Online Status Indicator */}
        <div className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-full text-xs font-medium ${
          isOnlineStatus ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {isOnlineStatus ? (
            <>
              <Wifi className="w-3 h-3" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span>Offline Mode</span>
            </>
          )}
          {!isNativeMode && stage !== 'initializing' && (
            <span className="ml-2 text-yellow-600">(Simulation Mode)</span>
          )}
        </div>

        {/* Amount Display */}
        <Card className="p-3 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
          <p className="text-sm text-gray-600 mb-0.5">المبلغ</p>
          <p className="text-2xl font-bold text-emerald-700">
            {formatAmount(amount)}
          </p>
        </Card>

        {/* Initializing Stage */}
        {(stage === 'initializing' || stage === 'nfc_check') && (
          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 mx-auto text-blue-600 animate-spin" />
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {stage === 'initializing' ? 'جاري التهيئة...' : 'فحص NFC...'}
                </h2>
                <p className="text-sm text-gray-600">
                  {stage === 'initializing' ? 'Initializing payment terminal...' : 'Checking NFC availability...'}
                </p>
              </div>
              
              {/* Diagnostic Logs */}
              <div className="mt-4 p-2 bg-gray-50 rounded text-left max-h-32 overflow-y-auto">
                {initLogs.map((log, i) => (
                  <p key={i} className="text-[10px] text-gray-500 font-mono">{log}</p>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-700">
                  خطأ في النظام
                </h2>
                <p className="text-sm text-red-600">
                  System Error
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  {errorMessage}
                </p>
              </div>

              {/* Diagnostic Logs */}
              <div className="mt-4 p-2 bg-white rounded text-left max-h-24 overflow-y-auto border">
                {initLogs.slice(-5).map((log, i) => (
                  <p key={i} className="text-[10px] text-gray-500 font-mono">{log}</p>
                ))}
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <KioskButton
                  variant="confirm"
                  size="sm"
                  onClick={handleRetrySetup}
                >
                  حاول مرة أخرى
                </KioskButton>
                <KioskButton
                  variant="secondary"
                  size="sm"
                  onClick={handleCancel}
                >
                  إلغاء
                </KioskButton>
              </div>
            </div>
          </Card>
        )}

        {/* Waiting Stage - Ready for Payment */}
        {stage === 'waiting' && (
          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              {/* NFC Ready Animation */}
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-blue-100 animate-ping opacity-30" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-blue-200 animate-pulse" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-blue-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  Soft POS (Thawani)
                </h2>
                <p className="text-sm text-gray-600">
                  اضغط للدفع بالبطاقة
                </p>
                <p className="text-xs text-gray-500">
                  Press to pay with card
                </p>
              </div>

              {/* Start Payment Button */}
              <KioskButton
                variant="confirm"
                size="lg"
                onClick={handleStartPayment}
                className="w-full py-4 text-lg"
              >
                <CreditCard className="w-6 h-6 mr-2" />
                ابدأ الدفع - Start Payment
              </KioskButton>

              {/* Supported Cards */}
              <div className="flex justify-center gap-2 pt-2">
                <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-6" />
                <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-6" />
                <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-6" />
                <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-6" />
              </div>

              {/* Mode indicator */}
              <div className="text-xs text-gray-400 pt-2">
                {isNativeMode ? (
                  <span className="text-green-600">✓ Thawani Lamsa SDK Ready</span>
                ) : (
                  <span className="text-yellow-600">⚠ Simulation Mode (Native SDK not available)</span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Processing Stage */}
        {stage === 'processing' && (
          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-blue-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  معالجة العملية...
                </h2>
                <p className="text-sm text-gray-600">
                  Processing payment...
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {isNativeMode 
                    ? 'Tap your card on the device screen'
                    : 'Simulating payment...'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Success Stage */}
        {stage === 'success' && (
          <Card className="p-6 bg-green-50 shadow-lg border-2 border-green-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-4xl">✓</span>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-green-700">
                  تمت العملية بنجاح
                </h2>
                <p className="text-sm text-green-600">
                  Payment Successful
                </p>
                {transactionResult && (
                  <div className="text-xs text-gray-600 mt-2 space-y-1">
                    {transactionResult.cardType && transactionResult.cardLastFour && (
                      <p>{transactionResult.cardType} •••• {transactionResult.cardLastFour}</p>
                    )}
                    {transactionResult.thawaniReference && (
                      <p>Thawani Ref: {transactionResult.thawaniReference}</p>
                    )}
                    {transactionResult.approvalCode && (
                      <p>Approval: {transactionResult.approvalCode}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Declined Stage */}
        {stage === 'declined' && (
          <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-4xl">✕</span>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-red-700">
                  تم رفض العملية
                </h2>
                <p className="text-sm text-red-600">
                  Payment Declined
                </p>
                {transactionResult?.error && (
                  <p className="text-xs text-gray-600 mt-2">
                    {transactionResult.error}
                  </p>
                )}
                {transactionResult?.errorCode && (
                  <p className="text-xs text-gray-500">
                    Code: {transactionResult.errorCode}
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <KioskButton
                  variant="confirm"
                  size="sm"
                  onClick={handleTryAgain}
                >
                  حاول مرة أخرى
                </KioskButton>
                <KioskButton
                  variant="secondary"
                  size="sm"
                  onClick={handleCancel}
                >
                  إلغاء
                </KioskButton>
              </div>
            </div>
          </Card>
        )}

        {/* Cancel Button for waiting/processing stages */}
        {(stage === 'waiting' || stage === 'processing') && (
          <div className="flex justify-center pt-2">
            <KioskButton
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={stage === 'processing'}
            >
              إلغاء
            </KioskButton>
          </div>
        )}
      </div>
    </KioskLayout>
  );
};

export default NFCPaymentPage;
