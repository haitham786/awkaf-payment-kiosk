import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const MobileNumberPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [mobileNumber, setMobileNumber] = useState("");

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

    // Simulate SMS sending
    toast({
      title: "تم الإرسال!",
      description: "تم إرسال الإيصال إلى رقم الهاتف المحدد",
      variant: "default",
    });

    // Return to homepage after 2 seconds
    setTimeout(() => {
      navigate('/kiosk');
    }, 2000);
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            إدخال رقم الهاتف
          </h1>
          <p className="text-xl text-muted-foreground">
            أدخل رقم هاتفك لاستلام إيصال التبرع
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mobile Number Input Section */}
          <Card className="p-8 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center mb-6">رقم الهاتف</h2>
              
              {/* Transaction Summary */}
              <div className="bg-gradient-card rounded-lg p-4 border border-primary/20 text-center">
                <p className="text-muted-foreground mb-1">مبلغ التبرع</p>
                <p className="text-2xl font-bold text-primary">
                  {formatAmount(amount)}
                </p>
              </div>

              {/* Mobile Number Display */}
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🇴🇲</span>
                  <span className="text-xl font-medium">+968</span>
                </div>
                
                <Input
                  value={mobileNumber}
                  readOnly
                  placeholder="أدخل رقم الهاتف"
                  className="text-3xl text-center h-16 bg-gradient-card border-2 border-primary/30 focus:border-primary shadow-card"
                  maxLength={8}
                />
                
                <p className="text-center text-muted-foreground">
                  8 أرقام (بدون +968)
                </p>
              </div>

              {/* Example */}
              <div className="bg-secondary/10 rounded-lg p-4 border border-secondary/30">
                <p className="text-center text-sm">
                  <span className="font-medium">مثال:</span> 91234567
                </p>
              </div>
            </div>
          </Card>

          {/* Keypad Section */}
          <Card className="p-8 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center mb-6">لوحة الأرقام</h2>
              
              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {keypadNumbers.map((row, rowIndex) => 
                  row.map((number, colIndex) => (
                    <KioskButton
                      key={`${rowIndex}-${colIndex}`}
                      variant="keypad"
                      onClick={() => handleKeypadPress(number)}
                      disabled={!number}
                      className="aspect-square"
                    >
                      {number}
                    </KioskButton>
                  ))
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-4">
                <KioskButton
                  variant="confirm"
                  size="xl"
                  onClick={handleSendSMS}
                  disabled={mobileNumber.length !== 8}
                  className="w-full"
                >
                  إرسال الإيصال
                </KioskButton>
                
                <KioskButton
                  variant="outline"
                  size="lg"
                  onClick={handleCancel}
                  className="w-full"
                >
                  إلغاء والعودة للرئيسية
                </KioskButton>
              </div>
            </div>
          </Card>
        </div>

        {/* SMS Info */}
        <Card className="mt-8 p-6 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              📱 سيصلك إيصال يحتوي على:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <p className="font-medium">رقم العملية</p>
                <p className="text-sm text-muted-foreground">للمراجعة والاستعلام</p>
              </div>
              <div className="text-center">
                <p className="font-medium">تفاصيل التبرع</p>
                <p className="text-sm text-muted-foreground">النوع والمبلغ والتاريخ</p>
              </div>
              <div className="text-center">
                <p className="font-medium">شكر وتقدير</p>
                <p className="text-sm text-muted-foreground">رسالة شكر من المؤسسة</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </KioskLayout>
  );
};

export default MobileNumberPage;