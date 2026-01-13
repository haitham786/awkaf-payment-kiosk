import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Home, X } from "lucide-react";

const MobileNumberPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const referenceNumber = searchParams.get('ref') || '';
  const transactionId = searchParams.get('transactionId') || '';
  const [mobileNumber, setMobileNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState(15);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 15-second inactivity timeout
  useEffect(() => {
    const timer = setInterval(() => {
      setInactivityTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/kiosk');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  // Reset timer on any interaction
  const resetTimer = () => {
    setInactivityTimer(15);
  };

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['⌫', '0', '']
  ];

  const handleKeypadPress = (value: string) => {
    resetTimer();
    if (value === '⌫') {
      setMobileNumber(prev => prev.slice(0, -1));
    } else if (value && mobileNumber.length < 8) {
      setMobileNumber(prev => prev + value);
    }
  };

  const handleSendSMS = async () => {
    if (mobileNumber.length !== 8) {
      toast({
        title: "رقم غير صحيح",
        description: "يرجى إدخال رقم هاتف صحيح مكون من 8 أرقام",
        variant: "destructive",
      });
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

      // Auto-close after 10 seconds
      setTimeout(() => {
        setShowConfirmation(false);
        navigate('/kiosk');
      }, 10000);
    } catch (error: any) {
      console.error('SMS Error:', error);
      toast({
        title: "خطأ في الإرسال",
        description: "حدث خطأ أثناء إرسال الرسالة. سيتم العودة للصفحة الرئيسية.",
        variant: "destructive",
      });

      setTimeout(() => {
        navigate('/kiosk');
      }, 2000);
    } finally {
      setSending(false);
    }
  };

  const handleReturnHome = () => {
    navigate('/kiosk');
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-md mx-auto" onClick={resetTimer}>
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            إدخال رقم الهاتف
          </h1>
        </div>

        {/* Mobile Number Input Section */}
        <Card className="p-4 bg-white/60 backdrop-blur-sm shadow-md border-0">
          <div className="space-y-3">
            {/* Mobile Number Display with +968 prefix inside field */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-gray-700">
                +968
              </div>
              <Input
                ref={inputRef}
                value={mobileNumber}
                readOnly
                placeholder="أدخل رقم الهاتف"
                className="text-2xl text-center h-14 bg-white/80 backdrop-blur-sm border-0 text-gray-900 pl-16"
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
                    soundEffect="keypad"
                    onClick={() => handleKeypadPress(number)}
                    disabled={!number}
                    className="aspect-square bg-white/70 hover:bg-white/90 text-gray-900 border-0 text-xl font-bold"
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
              soundEffect="navigation"
              onClick={handleSendSMS}
              disabled={mobileNumber.length !== 8 || sending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            >
              {sending ? 'جاري الإرسال...' : 'إرسال الإيصال'}
            </KioskButton>
          </div>
        </Card>

        {/* Home Button - Centered, matching style */}
        <div className="flex justify-center mt-6">
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

        {/* SMS Confirmation Popup */}
        {showConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 max-w-xs text-center relative">
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  navigate('/kiosk');
                }}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-3">
                <span className="text-4xl">✓</span>
                <h3 className="text-lg font-bold text-gray-900">
                  تم إرسال الإيصال
                </h3>
                <p className="text-sm text-gray-600">
                  سيصلك الإيصال على رقم {mobileNumber}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </KioskLayout>
  );
};

export default MobileNumberPage;
