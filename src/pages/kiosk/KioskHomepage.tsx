import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryInfoDialog } from "@/components/kiosk/CategoryInfoDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const KioskHomepage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kioskStatus, setKioskStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
  const [kioskMessage, setKioskMessage] = useState('');

  useEffect(() => {
    checkKioskStatus();
    loadCategories();
  }, []);

  const checkKioskStatus = async () => {
    try {
      const kioskId = localStorage.getItem('kiosk_id');
      if (!kioskId) {
        setKioskStatus('active');
        return;
      }

      const { data, error } = await supabase
        .from('kiosks')
        .select('status')
        .eq('id', kioskId)
        .single();

      if (error) throw error;

      if (data) {
        setKioskStatus(data.status);
        if (data.status === 'inactive') {
          setKioskMessage('هذا الكشك غير نشط حالياً. يرجى التواصل مع الإدارة.');
        } else if (data.status === 'maintenance') {
          setKioskMessage('الكشك قيد الصيانة. نعتذر عن الإزعاج.');
        }
      }
    } catch (error) {
      console.error('Error checking kiosk status:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('donation_categories')
        .select('*')
        .eq('is_visible', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    if (kioskStatus !== 'active') {
      return;
    }
    navigate(`/kiosk/preset-amounts?category=${categoryId}`);
  };

  return (
    <KioskLayout showHomeButton={false}>
      {/* Setup button in top-right corner */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-2 right-2 z-50 w-10 h-10 rounded-full bg-white border border-gray-300 hover:bg-gray-100"
        onClick={() => navigate('/kiosk/setup')}
      >
        <Settings className="w-5 h-5 text-gray-700" />
      </Button>

      {/* Status Alert */}
      {kioskStatus !== 'active' && (
        <div className="w-full max-w-6xl mx-auto mb-4">
          <Alert className="bg-red-50 border-red-300">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-base text-right font-semibold text-red-800">
              {kioskMessage}
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      <div
        className="w-full max-w-6xl mx-auto"
        style={{
          opacity: kioskStatus !== 'active' ? 0.5 : 1,
          pointerEvents: kioskStatus !== 'active' ? 'none' : 'auto'
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          {/* Logo */}
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full shadow-lg flex items-center justify-center">
            <span className="text-4xl">🕌</span>
          </div>
          
          {/* Quranic verse */}
          <div className="bg-gray-50 rounded-xl p-4 shadow-sm border border-gray-200 mb-4">
            <p className="text-xl font-bold text-gray-800 leading-relaxed">
              "وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ"
            </p>
            <p className="text-sm text-emerald-700 mt-2 font-semibold">
              القرآن الكريم - سورة البقرة
            </p>
          </div>

          <h1 className="text-3xl font-bold mb-2 text-gray-900">نظام التبرعات الرقمي</h1>
          <p className="text-lg text-emerald-700 font-semibold">
            اختر نوع التبرع الذي ترغب في المساهمة به
          </p>
        </div>

        {/* Donation Categories Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {loading ? (
            <div className="col-span-2 text-center text-lg text-gray-600">
              جاري التحميل...
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-2 text-center text-lg text-gray-500">
              لا توجد فئات متاحة حالياً
            </div>
          ) : (
            categories.map((category, index) => (
              <Card
                key={category.id}
                className="p-0 overflow-hidden bg-white border-2 border-gray-300 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 group relative min-h-[140px]"
              >
                <CategoryInfoDialog
                  title={category.title}
                  description={category.description}
                  infoText={category.info_text || ''}
                />
                <KioskButton
                  variant="donation"
                  className="w-full h-full flex flex-col items-center justify-center space-y-2 border-0 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200"
                  onClick={() => handleCategorySelect(category.category_id)}
                >
                  {category.icon_url ? (
                    <div className="w-12 h-12 mb-1 group-hover:scale-110 transition-transform duration-300">
                      <img
                        src={category.icon_url}
                        alt={category.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-3xl mb-1 group-hover:scale-110 transition-transform duration-300">
                      📿
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {category.title}
                  </h3>
                </KioskButton>
              </Card>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-emerald-700 text-base font-semibold">
            المس الشاشة لاختيار نوع التبرع
          </p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default KioskHomepage;
