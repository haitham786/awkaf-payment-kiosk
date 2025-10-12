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
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            تحديد مبلغ التبرع
          </h1>
          <p className="text-lg text-gray-700">
            نوع التبرع: <span className="font-semibold text-emerald-700">{getCategoryName(category)}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Amount Input Section */}
          <Card className="p-4 bg-white shadow-md border border-gray-300">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-center mb-4 text-gray-900">أدخل المبلغ</h2>
              
              {/* Rials Input */}
              <div className="space-y-2">
                <Label htmlFor="rials" className="text-base font-medium text-gray-900">ريال عماني</Label>
                <Input
                  id="rials"
                  value={rials}
                  readOnly
                  placeholder="0"
                  className={`text-3xl text-center h-16 bg-gray-50 transition-all text-gray-900 ${
                    activeField === 'rials' ? 'border-2 border-emerald-500 shadow-md' : 'border border-gray-300'
                  }`}
                  onClick={() => setActiveField('rials')}
                />
              </div>

              {/* Baisas Input */}
              <div className="space-y-2">
                <Label htmlFor="baisas" className="text-base font-medium text-gray-900">بيسة</Label>
                <Input
                  id="baisas"
                  value={baisas}
                  readOnly
                  placeholder="0"
                  className={`text-3xl text-center h-16 bg-gray-50 transition-all text-gray-900 ${
                    activeField === 'baisas' ? 'border-2 border-emerald-500 shadow-md' : 'border border-gray-300'
                  }`}
                  onClick={() => setActiveField('baisas')}
                />
              </div>

              {/* Total Display */}
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-300">
                <p className="text-center text-base">
                  <span className="font-medium text-gray-700">المجموع: </span>
                  <span className="text-2xl font-bold text-emerald-700">
                    {rials || '0'}.{(baisas || '0').padStart(3, '0')} ر.ع
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* Keypad Section */}
          <Card className="p-4 bg-white shadow-md border border-gray-300">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-center mb-4 text-gray-900">لوحة الأرقام</h2>
              
              {/* Field Selection */}
              <div className="grid grid-cols-2 gap-3">
                <KioskButton
                  variant={activeField === 'rials' ? 'default' : 'outline'}
                  onClick={() => setActiveField('rials')}
                  className={`h-12 text-base ${activeField === 'rials' ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-gray-300 text-gray-900'}`}
                >
                  ريال
                </KioskButton>
                <KioskButton
                  variant={activeField === 'baisas' ? 'default' : 'outline'}
                  onClick={() => setActiveField('baisas')}
                  className={`h-12 text-base ${activeField === 'baisas' ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-gray-300 text-gray-900'}`}
                >
                  بيسة
                </KioskButton>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {keypadNumbers.flat().map((number, index) => (
                  <KioskButton
                    key={index}
                    variant="keypad"
                    onClick={() => handleKeypadPress(number)}
                    disabled={!activeField}
                    className="aspect-square text-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300"
                  >
                    {number}
                  </KioskButton>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Continue Button */}
        <div className="text-center mt-4">
          <KioskButton
            variant="confirm"
            onClick={handleContinue}
            disabled={!rials && !baisas}
            className="min-w-[280px] h-14 text-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            متابعة إلى التأكيد
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default AmountPage;
