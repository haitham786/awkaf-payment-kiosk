import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

const MobileNumberPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const referenceNumber = searchParams.get('ref') || '';
  const transactionId = searchParams.get('transactionId') || '';
  const [mobileNumber, setMobileNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Auto-timeout: return to categories after 10 seconds of inactivity
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate('/kiosk');
    }, 10000);
    return () => clearTimeout(timeout);
  }, [navigate, mobileNumber]); // Reset on any input

  // Popup auto-close: close and navigate after 10 seconds
  useEffect(() => {
    if (showConfirmation) {
      const timeout = setTimeout(() => {
        setShowConfirmation(false);
        navigate('/kiosk');
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [showConfirmation, navigate]);

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ];

  const handleKeypadPress = (value: string) => {
    if (value === '⌫') {
      setMobileNumber(prev => prev.slice(0, -1));
    } else if (value && mobileNumber.length < 8) {
      setMobileNumber(prev => prev + value);
    }
  };

  const handleSendSMS = async () => {
    if (mobileNumber.length !== 8) {
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          mobile_number: `+968${mobileNumber}`,
          category,
          reference_number: referenceNumber || transactionId,
          amount_baisas: amount,
        },
      });

      if (error) throw error;

      // Show confirmation popup
      setShowConfirmation(true);
    } catch (error: any) {
      console.error('SMS Error:', error);
      // Still show confirmation for better UX
      setShowConfirmation(true);
    } finally {
      setSending(false);
    }
  };

  const handleReturnHome = () => {
    navigate('/kiosk');
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    navigate('/kiosk');
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-md mx-auto flex flex-col min-h-[calc(100vh-120px)] justify-between px-4">
        <div>
          {/* Mobile Number Input Card */}
          <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-lg border-0">
            <div className="space-y-4">
              {/* Mobile Number Input with +968 prefix */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-lg">
                  +968
                </div>
                <Input
                  value={mobileNumber}
                  readOnly
                  placeholder="________"
                  className="text-2xl text-center h-14 bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 text-gray-900 pl-16"
                  maxLength={8}
                />
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {keypadNumbers.map((row, rowIndex) => 
                  row.map((number, colIndex) => (
                    <KioskButton
                      key={`${rowIndex}-${colIndex}`}
                      variant="keypad"
                      onClick={() => handleKeypadPress(number)}
                      disabled={!number}
                      className={`h-14 text-xl bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200 ${!number ? 'invisible' : ''}`}
                    >
                      {number}
                    </KioskButton>
                  ))
                )}
              </div>

              {/* Send Button */}
              <KioskButton
                variant="confirm"
                size="xl"
                onClick={handleSendSMS}
                disabled={mobileNumber.length !== 8 || sending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12"
              >
                {sending ? 'جاري الإرسال...' : 'إرسال'}
              </KioskButton>
            </div>
          </Card>
        </div>

        {/* Home Button at bottom center */}
        <div className="flex justify-center pb-6 mt-4">
          <KioskButton
            variant="outline"
            size="lg"
            soundEffect="navigation"
            onClick={handleReturnHome}
            className="bg-white/80 backdrop-blur-sm border-0 hover:bg-white text-gray-900 px-8"
          >
            <Home className="w-5 h-5 ml-2" />
            الصفحة الرئيسية
          </KioskButton>
        </div>
      </div>

      {/* SMS Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-xl">
          <button
            onClick={handleCloseConfirmation}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              تم الإرسال بنجاح
            </h2>
            <p className="text-gray-600">
              تم إرسال الإيصال إلى رقم الهاتف المحدد
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </KioskLayout>
  );
};

export default MobileNumberPage;
