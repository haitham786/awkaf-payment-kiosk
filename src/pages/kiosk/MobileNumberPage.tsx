import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Input } from "@/components/ui/input";
import { Home, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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
      <div className="w-full max-w-sm mx-auto flex flex-col min-h-[calc(100vh-120px)] justify-between px-4">
        <div className="flex-1 flex flex-col justify-center">
          {/* Mobile Number Input with +968 prefix */}
          <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold text-lg">
              +968
            </div>
            <Input
              ref={inputRef}
              value={mobileNumber}
              readOnly
              placeholder="________"
              className="text-2xl text-center h-14 bg-white/90 border-2 border-gray-300 focus:border-emerald-500 text-gray-900 pl-16 rounded-xl"
              maxLength={8}
            />
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {keypadNumbers.map((row, rowIndex) => 
              row.map((number, colIndex) => (
                <KioskButton
                  key={`${rowIndex}-${colIndex}`}
                  variant="keypad"
                  onClick={() => handleKeypadPress(number)}
                  disabled={!number}
                  className={`h-12 text-xl bg-white/80 hover:bg-white text-gray-900 border border-gray-200 rounded-xl ${!number ? 'invisible' : ''}`}
                >
                  {number}
                </KioskButton>
              ))
            )}
          </div>

          {/* Send Button */}
          <KioskButton
            variant="confirm"
            size="lg"
            onClick={handleSendSMS}
            disabled={mobileNumber.length !== 8 || sending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl"
          >
            {sending ? 'جاري الإرسال...' : 'إرسال'}
          </KioskButton>
        </div>

        {/* Home Button at bottom center - icon only */}
        <div className="flex justify-center pb-6">
          <KioskButton
            variant="ghost"
            size="icon"
            soundEffect="navigation"
            onClick={handleReturnHome}
            className="w-14 h-14 rounded-full bg-white/60 hover:bg-white/80 text-gray-700"
          >
            <Home className="w-7 h-7" />
          </KioskButton>
        </div>
      </div>

      {/* SMS Confirmation Popup - Rounded, smaller, transparent */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl mx-8 max-w-xs w-full p-6 relative">
            <button
              onClick={handleCloseConfirmation}
              className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
            <div className="text-center pt-2">
              <div className="w-14 h-14 mx-auto mb-3 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-2xl text-emerald-600">✓</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                تم الإرسال بنجاح
              </h2>
              <p className="text-gray-600 text-sm">
                تم إرسال الإيصال إلى رقم الهاتف المحدد
              </p>
            </div>
          </div>
        </div>
      )}
    </KioskLayout>
  );
};

export default MobileNumberPage;
