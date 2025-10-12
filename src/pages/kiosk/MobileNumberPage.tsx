import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
    ['⌫', '', '']
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

      toast({
        title: "تم الإرسال!",
        description: "تم إرسال الإيصال إلى رقم الهاتف المحدد",
        variant: "default",
      });

      // Return to homepage after 2 seconds
      setTimeout(() => {
        navigate('/kiosk');
      }, 2000);
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

  const handleCancel = () => {
    navigate('/kiosk');
  };

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  return (
    <KioskLayout>
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            إدخال رقم الهاتف
          </h1>
          <p className="text-base text-gray-600">
            أدخل رقم هاتفك لاستلام إيصال التبرع
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Mobile Number Input Section */}
          <Card className="p-4 bg-white shadow-md border border-gray-300">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-center mb-3 text-gray-900">رقم الهاتف</h2>
              
              {/* Transaction Summary */}
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-300 text-center">
                <p className="text-gray-600 mb-1 text-sm">مبلغ التبرع</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatAmount(amount)}
                </p>
              </div>

              {/* Mobile Number Display */}
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-xl">🇴🇲</span>
                  <span className="text-lg font-medium text-gray-900">+968</span>
                </div>
                
                <Input
                  value={mobileNumber}
                  readOnly
                  placeholder="أدخل رقم الهاتف"
                  className="text-2xl text-center h-12 bg-gray-50 border-2 border-gray-300 focus:border-emerald-500 text-gray-900"
                  maxLength={8}
                />
                
                <p className="text-center text-gray-600 text-sm">
                  8 أرقام (بدون +968)
                </p>
              </div>

              {/* Example */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-center text-sm text-gray-700">
                  <span className="font-medium">مثال:</span> 91234567
                </p>
              </div>
            </div>
          </Card>

          {/* Keypad Section */}
          <Card className="p-4 bg-white shadow-md border border-gray-300">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-center mb-3 text-gray-900">لوحة الأرقام</h2>
              
              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {keypadNumbers.map((row, rowIndex) => 
                  row.map((number, colIndex) => (
                    <KioskButton
                      key={`${rowIndex}-${colIndex}`}
                      variant="keypad"
                      onClick={() => handleKeypadPress(number)}
                      disabled={!number}
                      className="aspect-square bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300"
                    >
                      {number}
                    </KioskButton>
                  ))
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <KioskButton
                  variant="confirm"
                  size="xl"
                  onClick={handleSendSMS}
                  disabled={mobileNumber.length !== 8 || sending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {sending ? 'جاري الإرسال...' : 'إرسال الإيصال'}
                </KioskButton>
                
                <KioskButton
                  variant="outline"
                  size="lg"
                  onClick={handleCancel}
                  className="w-full bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-900"
                >
                  إلغاء والعودة للرئيسية
                </KioskButton>
              </div>
            </div>
          </Card>
        </div>

        {/* SMS Info */}
        <Card className="mt-4 p-4 bg-white shadow-md border border-gray-300">
          <div className="text-center space-y-2">
            <h3 className="text-base font-semibold text-gray-900">
              📱 سيصلك إيصال يحتوي على:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div className="text-center">
                <p className="font-medium text-gray-900 text-sm">رقم العملية</p>
                <p className="text-xs text-gray-600">للمراجعة والاستعلام</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 text-sm">تفاصيل التبرع</p>
                <p className="text-xs text-gray-600">النوع والمبلغ والتاريخ</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 text-sm">شكر وتقدير</p>
                <p className="text-xs text-gray-600">رسالة شكر من المؤسسة</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </KioskLayout>
  );
};

export default MobileNumberPage;