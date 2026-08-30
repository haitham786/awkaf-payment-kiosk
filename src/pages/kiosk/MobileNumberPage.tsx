import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sendDonationReceipt } from "@/lib/receiptDispatcher";
import { Home, X, CheckCircle, AlertCircle, Delete, Eraser } from "lucide-react";

const MobileNumberPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const referenceNumber = searchParams.get('ref') || '';
  const posReference = searchParams.get('posRef') || '';
  const transactionId = searchParams.get('transactionId') || '';
  const [mobileNumber, setMobileNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState<'success' | 'error'>('success');
  const [popupMessage, setPopupMessage] = useState('');
  const [inactivityTimer, setInactivityTimer] = useState(15);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setInactivityTimer(prev => {
        if (prev <= 1) { clearInterval(timer); navigate('/kiosk'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  const resetTimer = () => setInactivityTimer(15);

  const handleKeypadPress = (value: string) => {
    resetTimer();
    if (value === 'back') setMobileNumber(prev => prev.slice(0, -1));
    else if (value === 'clear') setMobileNumber('');
    else if (value && mobileNumber.length < 8) setMobileNumber(prev => prev + value);
  };

  const showResultPopup = (type: 'success' | 'error', message: string) => {
    setPopupType(type);
    setPopupMessage(message);
    setShowPopup(true);
    setTimeout(() => { setShowPopup(false); navigate('/kiosk'); }, 5000);
  };

  const handleSendSMS = async () => {
    if (mobileNumber.length !== 8) {
      toast({ title: "رقم غير صحيح", description: "يرجى إدخال رقم هاتف صحيح مكون من 8 أرقام", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const result = await sendDonationReceipt({
        mobile_number: `968${mobileNumber}`,
        category,
        reference_number: referenceNumber || transactionId,
        pos_rrn: posReference || undefined,
        transaction_id: transactionId || undefined,
        amount_baisas: amount,
      });
      if (result.ok) {
        showResultPopup('success', `تم إرسال الإيصال بنجاح إلى الرقم ${mobileNumber}`);
      } else {
        const err = result.sms?.error || result.whatsapp?.error || 'حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة لاحقاً.';
        showResultPopup('error', err);
      }
    } catch (error: any) {
      showResultPopup('error', 'نظام الرسائل غير متاح حالياً. يرجى المحاولة لاحقاً.');
    } finally { setSending(false); }
  };

  const handleReturnHome = () => navigate('/kiosk');

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-md mx-auto" onClick={resetTimer}>
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900">إدخال رقم الهاتف</h1>
          <p className="text-sm text-gray-600">Enter Phone Number</p>
        </div>

        <Card className="p-4 bg-white/60 backdrop-blur-sm shadow-md border-0">
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-gray-700 z-10">+968</div>
              <Input ref={inputRef} value={mobileNumber} readOnly placeholder="" className="text-2xl text-center h-14 bg-gray-200 border-0 text-gray-900 pl-16 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none" maxLength={8} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9'].map((n) => (
                <KioskButton key={n} variant="keypad" soundEffect="keypad" onClick={() => handleKeypadPress(n)} className="aspect-square bg-white/70 hover:bg-white/90 text-gray-900 border-0 text-xl font-bold">
                  {n}
                </KioskButton>
              ))}
              <KioskButton variant="keypad" soundEffect="keypad" onClick={() => handleKeypadPress('back')} aria-label="Backspace" className="aspect-square bg-white/70 hover:bg-red-50/90 text-gray-800 border-0 text-xl font-bold">
                <Delete className="w-5 h-5" />
              </KioskButton>
              <KioskButton variant="keypad" soundEffect="keypad" onClick={() => handleKeypadPress('0')} className="aspect-square bg-white/70 hover:bg-white/90 text-gray-900 border-0 text-xl font-bold">
                0
              </KioskButton>
              <KioskButton variant="keypad" soundEffect="keypad" onClick={() => handleKeypadPress('clear')} aria-label="Clear" className="aspect-square bg-white/70 hover:bg-amber-50/90 text-gray-800 border-0 text-xl font-bold">
                <Eraser className="w-5 h-5" />
              </KioskButton>
            </div>
          </div>
        </Card>

        <div className="flex justify-center mt-4">
          <KioskButton
            variant="secondary"
            size="sm"
            soundEffect="navigation"
            onClick={handleSendSMS}
            disabled={mobileNumber.length !== 8 || sending}
            className="h-auto px-10 py-4 text-xs font-bold bg-white/50 hover:bg-white/70 backdrop-blur-sm text-gray-900 border-0 flex flex-col items-center gap-1 rounded-xl"
          >
            <span className="text-sm">{sending ? 'جاري الإرسال...' : 'إرسال الإيصال'}</span>
            <span className="text-gray-900">{sending ? 'Sending...' : 'Send Receipt'}</span>
          </KioskButton>
        </div>

        <div className="flex justify-center mt-6">
          <KioskButton variant="ghost" size="lg" soundEffect="navigation" onClick={handleReturnHome} className="bg-transparent hover:bg-white/10 backdrop-blur-sm shadow-none border-0 p-3">
            <Home className="w-8 h-8 text-white drop-shadow-lg" />
          </KioskButton>
        </div>

        {showPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 mx-4 max-w-xs text-center relative shadow-xl">
              <button onClick={() => { setShowPopup(false); navigate('/kiosk'); }} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-3">
                {popupType === 'success' ? <CheckCircle className="w-16 h-16 mx-auto text-emerald-600" /> : <AlertCircle className="w-16 h-16 mx-auto text-red-600" />}
                <h3 className="text-lg font-bold text-gray-900">
                  {popupType === 'success' ? 'تم بنجاح' : 'خطأ'}
                </h3>
                <p className="text-xs text-gray-400">
                  {popupType === 'success' ? 'Success' : 'Error'}
                </p>
                <p className="text-sm text-gray-600">{popupMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </KioskLayout>
  );
};

export default MobileNumberPage;
