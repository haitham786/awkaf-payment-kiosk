import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  initializeSoftPOS,
  startNFCTransaction,
  onCardTapped,
  onSoftPOSApproval,
  onSoftPOSFailure,
  cancelTransaction,
  simulateCardTap,
  SoftPOSTransactionResult,
} from "@/services/softPosService";
import { queueTransaction, isOnline } from "@/services/offlineQueueService";
import { Wifi, WifiOff, CreditCard } from "lucide-react";

type PaymentStage = 'waiting' | 'processing' | 'success' | 'declined';

const NFCPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  
  const [stage, setStage] = useState<PaymentStage>('waiting');
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline());
  const [transactionResult, setTransactionResult] = useState<SoftPOSTransactionResult | null>(null);
  const [categoryData, setCategoryData] = useState<any>(null);
  const transactionId = crypto.randomUUID();
  const kioskId = localStorage.getItem('kiosk_id') || "3fa85f64-5717-4562-b3fc-2c963f66afa6";

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
    try {
      // Load SoftPOS config from kiosk_settings
      const { data: settings } = await supabase
        .from('kiosk_settings')
        .select('soft_pos_config')
        .limit(1)
        .maybeSingle();

      if (settings?.soft_pos_config) {
        const config = settings.soft_pos_config as any;
        await initializeSoftPOS({
          merchantId: config.merchant_id || '',
          terminalId: config.terminal_id || '',
          apiKey: config.api_key || '',
          sdkEndpoint: config.sdk_endpoint || '',
          callbackUrl: config.callback_url || '',
          providerName: config.provider_name || '',
        });
      }

      // Register callbacks
      onCardTapped((cardData) => {
        console.log('Card detected:', cardData);
        setStage('processing');
      });

      onSoftPOSApproval((result) => {
        console.log('Payment approved:', result);
        setTransactionResult(result);
        handlePaymentSuccess(result);
      });

      onSoftPOSFailure((error) => {
        console.log('Payment failed:', error);
        setStage('declined');
        setTransactionResult({ success: false, error });
      });

      // Start the transaction
      await startNFCTransaction(amount, 'OMR', transactionId);
    } catch (error) {
      console.error('Failed to initialize payment:', error);
      toast.error('Failed to initialize payment terminal');
    }
  }, [amount, transactionId]);

  useEffect(() => {
    initializePayment();

    return () => {
      cancelTransaction();
    };
  }, [initializePayment]);

  const handlePaymentSuccess = async (result: SoftPOSTransactionResult) => {
    setStage('success');

    const transactionData = {
      transactionId,
      kioskId,
      amount,
      category,
      paymentResult: result,
      createdAt: new Date().toISOString(),
    };

    if (isOnline()) {
      // Process immediately if online
      try {
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            transactionId,
            kioskId,
            amount,
            category,
            mobileNumber: null,
            softPosResult: result,
          },
        });

        if (error) throw error;

        // Navigate to thank you page after short delay
        setTimeout(() => {
          navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data.transaction?.reference_number || transactionId}&catRef=${categoryData?.category_reference || ''}`);
        }, 2000);
      } catch (error) {
        console.error('Failed to process payment:', error);
        // Queue for later if processing fails
        queueTransaction(transactionData);
        toast.info('Payment saved. Will sync when online.');
        setTimeout(() => {
          navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&catRef=${categoryData?.category_reference || ''}`);
        }, 2000);
      }
    } else {
      // Queue for later if offline
      queueTransaction(transactionData);
      toast.info('Payment saved offline. Will sync automatically.');
      setTimeout(() => {
        navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&catRef=${categoryData?.category_reference || ''}`);
      }, 2000);
    }
  };

  const handleSimulatePayment = async () => {
    setStage('processing');
    try {
      const result = await simulateCardTap(amount, transactionId);
      if (result.success) {
        handlePaymentSuccess(result);
      } else {
        setStage('declined');
        setTransactionResult(result);
      }
    } catch (error) {
      console.error('Simulation error:', error);
      setStage('declined');
    }
  };

  const handleTryAgain = () => {
    setStage('waiting');
    setTransactionResult(null);
    initializePayment();
  };

  const handleCancel = () => {
    cancelTransaction();
    navigate(`/kiosk/amount?category=${category}`);
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
        </div>

        {/* Amount Display */}
        <Card className="p-3 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
          <p className="text-sm text-gray-600 mb-0.5">المبلغ</p>
          <p className="text-2xl font-bold text-emerald-700">
            {formatAmount(amount)}
          </p>
        </Card>

        {/* Payment Stage UI */}
        {stage === 'waiting' && (
          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              {/* NFC Animation */}
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-blue-100 animate-ping opacity-30" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-blue-200 animate-pulse" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-blue-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  المس بطاقتك للتبرع
                </h2>
                <p className="text-sm text-gray-600">
                  Tap your card to donate
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  يرجى وضع البطاقة على قارئ NFC
                </p>
              </div>

              {/* Supported Cards */}
              <div className="flex justify-center gap-2 pt-2">
                <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-6" />
                <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-6" />
                <img src="/images/payment-logos/applepay.svg" alt="Apple Pay" className="h-6" />
                <img src="/images/payment-logos/samsungpay.svg" alt="Samsung Pay" className="h-6" />
              </div>

              {/* Test Button - Development Only */}
              <div className="pt-4 border-t border-gray-200 mt-4">
                <KioskButton
                  variant="secondary"
                  size="sm"
                  onClick={handleSimulatePayment}
                  className="text-xs"
                >
                  🧪 Simulate Card Tap (Dev Only)
                </KioskButton>
              </div>
            </div>
          </Card>
        )}

        {stage === 'processing' && (
          <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
            <div className="space-y-4">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">💳</span>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  معالجة العملية...
                </h2>
                <p className="text-sm text-gray-600">
                  Processing payment...
                </p>
              </div>
            </div>
          </Card>
        )}

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
                  <p className="text-xs text-gray-600 mt-2">
                    {transactionResult.cardType} •••• {transactionResult.cardLastFour}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

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

        {/* Cancel Button for waiting stage */}
        {stage === 'waiting' && (
          <div className="flex justify-center pt-2">
            <KioskButton
              variant="secondary"
              size="sm"
              onClick={handleCancel}
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
