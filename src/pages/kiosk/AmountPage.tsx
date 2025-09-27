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
  const [activeField, setActiveField] = useState<'rials' | 'baisas' | null>(null);

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
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            تحديد مبلغ التبرع
          </h1>
          <p className="text-xl text-muted-foreground">
            نوع التبرع: <span className="font-semibold text-secondary">{getCategoryName(category)}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Amount Input Section */}
          <Card className="p-8 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center mb-6">أدخل المبلغ</h2>
              
              {/* Rials Input */}
              <div className="space-y-2">
                <Label htmlFor="rials" className="text-lg font-medium">ريال عماني</Label>
                <Input
                  id="rials"
                  value={rials}
                  readOnly
                  placeholder="0"
                  className={`text-3xl text-center h-16 bg-gradient-card border-2 ${
                    activeField === 'rials' ? 'border-primary shadow-elegant' : 'border-primary/30'
                  }`}
                  onClick={() => setActiveField('rials')}
                />
              </div>

              {/* Baisas Input */}
              <div className="space-y-2">
                <Label htmlFor="baisas" className="text-lg font-medium">بيسة</Label>
                <Input
                  id="baisas"
                  value={baisas}
                  readOnly
                  placeholder="0"
                  className={`text-3xl text-center h-16 bg-gradient-card border-2 ${
                    activeField === 'baisas' ? 'border-primary shadow-elegant' : 'border-primary/30'
                  }`}
                  onClick={() => setActiveField('baisas')}
                />
              </div>

              {/* Total Display */}
              <div className="bg-gradient-primary/10 rounded-lg p-4 border border-primary/30">
                <p className="text-center text-lg">
                  <span className="font-medium">المجموع: </span>
                  <span className="text-2xl font-bold text-primary">
                    {rials || '0'}.{(baisas || '0').padStart(3, '0')} ر.ع
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* Keypad Section */}
          <Card className="p-8 bg-card/80 backdrop-blur-sm shadow-card border border-primary/20">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-center mb-6">لوحة الأرقام</h2>
              
              {/* Field Selection */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <KioskButton
                  variant={activeField === 'rials' ? 'default' : 'outline'}
                  size="kiosk"
                  onClick={() => setActiveField('rials')}
                >
                  ريال
                </KioskButton>
                <KioskButton
                  variant={activeField === 'baisas' ? 'default' : 'outline'}
                  size="kiosk"
                  onClick={() => setActiveField('baisas')}
                >
                  بيسة
                </KioskButton>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {keypadNumbers.flat().map((number, index) => (
                  <KioskButton
                    key={index}
                    variant="keypad"
                    onClick={() => handleKeypadPress(number)}
                    disabled={!activeField}
                    className="aspect-square"
                  >
                    {number}
                  </KioskButton>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Continue Button */}
        <div className="text-center mt-8">
          <KioskButton
            variant="confirm"
            size="xl"
            onClick={handleContinue}
            disabled={!rials && !baisas}
            className="min-w-[300px]"
          >
            متابعة إلى التأكيد
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default AmountPage;