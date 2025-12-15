import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  startTransaction, 
  getConnectionStatus, 
  getErrorMessage,
  TransactionResponse 
} from "@/services/hardPosService";

type PaymentStage = 'waiting' | 'processing' | 'success' | 'declined' | 'error';

const PaymentProcessingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const mobile = searchParams.get('mobile') || null;
  
  const [stage, setStage] = useState<PaymentStage>('waiting');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [transactionRef, setTransactionRef] = useState('');

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Generate transaction ID
        const transactionId = crypto.randomUUID();
        const kioskId = localStorage.getItem('kiosk_id') || "3fa85f64-5717-4562-b3fc-2c963f66afa6";

        // Check POS connection status
        const connectionStatus = getConnectionStatus();
        
        if (connectionStatus !== 'connected') {
          // POS not connected - show error
          setStage('error');
          setErrorMessage(getErrorMessage('POS_NOT_CONNECTED'));
          return;
        }

        setStage('processing');

        // Start progress animation
        const progressInterval = setInterval(() => {
          setProgress(prev => Math.min(prev + 2, 90));
        }, 100);

        // Send transaction to POS
        const posResponse: TransactionResponse = await startTransaction({
          transactionId,
          amount,
        });

        clearInterval(progressInterval);

        if (posResponse.success) {
          setProgress(100);
          setStage('success');
          setTransactionRef(posResponse.referenceNumber || '');

          // Call edge function to record successful payment
          const { data, error } = await supabase.functions.invoke('process-payment', {
            body: {
              transactionId,
              kioskId,
              amount,
              category,
              mobileNumber: mobile,
              posResponse: {
                referenceNumber: posResponse.referenceNumber,
                authCode: posResponse.authCode,
                cardLastFour: posResponse.cardLastFour,
                cardType: posResponse.cardType,
              },
            },
          });

          if (error) {
            console.error('Failed to record transaction:', error);
          }

          // Fetch category reference
          const { data: categoryData } = await supabase
            .from('donation_categories')
            .select('category_reference')
            .eq('category_id', category)
            .maybeSingle();

          // Navigate to thank you page
          setTimeout(() => {
            navigate(`/kiosk/thank-you?category=${category}&amount=${amount}&ref=${data?.transaction?.reference_number || transactionId}&catRef=${categoryData?.category_reference || ''}`);
          }, 2000);
        } else {
          setStage('declined');
          setErrorMessage(posResponse.errorMessage || getErrorMessage(posResponse.errorCode || 'DECLINED'));
        }
      } catch (error: any) {
        console.error('Payment error:', error);
        setStage('error');
        setErrorMessage(error.message || getErrorMessage('COMMUNICATION_FAILURE'));
      }
    };

    // Wait a moment before starting transaction
    const timer = setTimeout(processPayment, 1000);
    return () => clearTimeout(timer);
  }, [navigate, category, amount, mobile]);

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  const handleRetry = () => {
    setStage('waiting');
    setProgress(0);
    setErrorMessage('');
    // Trigger re-process
    window.location.reload();
  };

  const handleCancel = () => {
    navigate(`/kiosk/error?category=${category}&amount=${amount}`);
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-3xl mx-auto">
        <div className="space-y-4">
          {/* Amount Display */}
          <Card className="p-4 bg-emerald-50 shadow-md border-2 border-emerald-300 text-center">
            <p className="text-base text-gray-600 mb-1">المبلغ</p>
            <p className="text-3xl font-bold text-emerald-700">
              {formatAmount(amount)}
            </p>
          </Card>

          {/* Processing Animation */}
          {(stage === 'waiting' || stage === 'processing') && (
            <Card className="p-6 bg-white shadow-lg border border-gray-300 text-center">
              <div className="space-y-4">
                {/* Animated Circle */}
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                  <div 
                    className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin"
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">💳</span>
                  </div>
                </div>

                {/* Progress Text */}
                <div className="space-y-3">
                  <h2 className="text-xl font-bold text-gray-900">
                    {stage === 'waiting' ? 'في انتظار الاتصال بالجهاز...' : 'معالجة العملية...'}
                  </h2>
                  
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-base font-semibold text-emerald-700">
                      {Math.round(progress)}%
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Success State */}
          {stage === 'success' && (
            <Card className="p-6 bg-emerald-50 shadow-lg border-2 border-emerald-300 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-4xl text-white">✓</span>
                </div>
                <h2 className="text-2xl font-bold text-emerald-700">
                  تمت العملية بنجاح
                </h2>
                {transactionRef && (
                  <p className="text-gray-600">
                    رقم المرجع: {transactionRef}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Declined State */}
          {stage === 'declined' && (
            <Card className="p-6 bg-red-50 shadow-lg border-2 border-red-300 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-4xl text-white">✗</span>
                </div>
                <h2 className="text-2xl font-bold text-red-700">
                  تم رفض العملية
                </h2>
                <p className="text-gray-600">
                  {errorMessage}
                </p>
                <div className="flex gap-3 justify-center pt-4">
                  <Button onClick={handleRetry} variant="default" size="lg">
                    حاول مرة أخرى
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="lg">
                    إلغاء
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Error State */}
          {stage === 'error' && (
            <Card className="p-6 bg-amber-50 shadow-lg border-2 border-amber-300 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-4xl text-white">⚠</span>
                </div>
                <h2 className="text-2xl font-bold text-amber-700">
                  خطأ في الاتصال
                </h2>
                <p className="text-gray-600">
                  {errorMessage}
                </p>
                <div className="flex gap-3 justify-center pt-4">
                  <Button onClick={handleRetry} variant="default" size="lg">
                    حاول مرة أخرى
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="lg">
                    إلغاء
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </KioskLayout>
  );
};

export default PaymentProcessingPage;
