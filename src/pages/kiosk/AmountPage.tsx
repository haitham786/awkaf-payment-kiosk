import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AmountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  
  const [rials, setRials] = useState("");
  const [baisas, setBaisas] = useState("");
  const [activeField, setActiveField] = useState<'rials' | 'baisas' | null>('rials');

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0', '00', '⌫']
  ];

  const handleKeypadPress = (value: string) => {
    if (!activeField) return;

    if (value === '⌫') {
      // Backspace
      if (activeField === 'rials') {
        setRials(prev => prev.slice(0, -1));
      } else {
        setBaisas(prev => prev.slice(0, -1));
      }
    } else {
      // Add number
      if (activeField === 'rials') {
        setRials(prev => prev + value);
      } else {
        setBaisas(prev => {
          const newValue = prev + value;
          // Limit baisas to 3 digits (max 999)
          return newValue.length <= 3 ? newValue : prev;
        });
      }
    }
  };

  const handleContinue = () => {
    if (rials || baisas) {
      const totalAmount = (parseFloat(rials || '0') * 1000) + parseFloat(baisas || '0');
      navigate(`/kiosk/confirmation?category=${category}&amount=${totalAmount}`);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const categories: Record<string, string> = {
      'zakat': 'زكاة',
      'sadaqah': 'صدقة',
      'charity': 'خيرية',
      'mosque': 'مسجد',
      'orphans': 'أيتام',
      'education': 'تعليم'
    };
    return categories[categoryId] || 'تبرع';
  };

  return (
    <KioskLayout>
      <div className="w-full h-full flex flex-col px-12 py-8" style={{ maxWidth: '1080px', maxHeight: '1920px' }}>
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-foreground mb-4">
            تحديد مبلغ التبرع
          </h1>
          <p className="text-3xl text-muted-foreground">
            نوع التبرع: <span className="font-semibold text-secondary">{getCategoryName(category)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 flex-1">
          {/* Amount Input Section */}
          <Card className="p-10 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20 flex flex-col">
            <div className="space-y-8 flex-1 flex flex-col justify-center">
              <h2 className="text-4xl font-semibold text-center mb-8">أدخل المبلغ</h2>
              
              {/* Rials Input */}
              <div className="space-y-3">
                <Label htmlFor="rials" className="text-2xl font-medium">ريال عماني</Label>
                <Input
                  id="rials"
                  value={rials}
                  readOnly
                  placeholder="0"
                  className={`text-5xl text-center h-24 bg-gradient-card transition-all ${
                    activeField === 'rials' ? 'border-[3px] border-blue-500 shadow-elegant' : 'border-2 border-primary/30'
                  }`}
                  onClick={() => setActiveField('rials')}
                />
              </div>

              {/* Baisas Input */}
              <div className="space-y-3">
                <Label htmlFor="baisas" className="text-2xl font-medium">بيسة</Label>
                <Input
                  id="baisas"
                  value={baisas}
                  readOnly
                  placeholder="0"
                  className={`text-5xl text-center h-24 bg-gradient-card transition-all ${
                    activeField === 'baisas' ? 'border-[3px] border-blue-500 shadow-elegant' : 'border-2 border-primary/30'
                  }`}
                  onClick={() => setActiveField('baisas')}
                />
              </div>

              {/* Total Display */}
              <div className="bg-gradient-primary/10 rounded-lg p-6 border border-primary/30 mt-auto">
                <p className="text-center text-2xl">
                  <span className="font-medium">المجموع: </span>
                  <span className="text-4xl font-bold text-primary">
                    {rials || '0'}.{(baisas || '0').padStart(3, '0')} ر.ع
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* Keypad Section */}
          <Card className="p-10 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20 flex flex-col">
            <div className="space-y-6 flex-1 flex flex-col">
              <h2 className="text-4xl font-semibold text-center mb-8">لوحة الأرقام</h2>
              
              {/* Field Selection */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <KioskButton
                  variant={activeField === 'rials' ? 'default' : 'outline'}
                  onClick={() => setActiveField('rials')}
                  className="h-20 text-2xl"
                >
                  ريال
                </KioskButton>
                <KioskButton
                  variant={activeField === 'baisas' ? 'default' : 'outline'}
                  onClick={() => setActiveField('baisas')}
                  className="h-20 text-2xl"
                >
                  بيسة
                </KioskButton>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-5 flex-1">
                {keypadNumbers.flat().map((number, index) => (
                  <KioskButton
                    key={index}
                    variant="keypad"
                    onClick={() => handleKeypadPress(number)}
                    disabled={!activeField}
                    className="aspect-square text-4xl min-h-[100px]"
                  >
                    {number}
                  </KioskButton>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Continue Button */}
        <div className="text-center mt-10">
          <KioskButton
            variant="confirm"
            onClick={handleContinue}
            disabled={!rials && !baisas}
            className="min-w-[400px] h-20 text-3xl"
          >
            متابعة إلى التأكيد
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default AmountPage;