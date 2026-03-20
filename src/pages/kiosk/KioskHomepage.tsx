import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryInfoDialog } from "@/components/kiosk/CategoryInfoDialog";

// Cache for preloaded images
const imageCache = new Map<string, boolean>();

const KioskHomepage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const [quranicVerse, setQuranicVerse] = useState<string>("");
  const [kioskStatus, setKioskStatus] = useState<'active' | 'inactive' | 'maintenance' | 'pending_approval' | 'disconnected' | 'unregistered'>(() => {
    const kioskId = localStorage.getItem('kiosk_id');
    return kioskId ? 'active' : 'unregistered';
  });
  const [kioskMessage, setKioskMessage] = useState('');

  const preloadImages = async (cats: any[]) => {
    const imagePromises = cats
      .filter(cat => cat.icon_url && !imageCache.has(cat.icon_url))
      .map(cat => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { imageCache.set(cat.icon_url, true); resolve(); };
          img.onerror = () => { imageCache.set(cat.icon_url, false); resolve(); };
          img.src = cat.icon_url;
        });
      });
    await Promise.all(imagePromises);
    setImagesPreloaded(true);
  };

  useEffect(() => {
    checkKioskStatus();
    loadCategories();
    
    const kioskId = localStorage.getItem('kiosk_id');
    const kioskChannel = supabase
      .channel('kiosk-changes')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'kiosks', filter: kioskId ? `id=eq.${kioskId}` : undefined }, () => {
        setKioskStatus('disconnected');
        setKioskMessage('تم فصل هذا الكشك من النظام. يرجى التواصل مع الإدارة.');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kiosks', filter: kioskId ? `id=eq.${kioskId}` : undefined }, (payload) => {
        const newStatus = payload.new.status;
        setKioskStatus(newStatus);
        if (newStatus === 'pending_approval') setKioskMessage('في انتظار الموافقة من الإدارة على تفعيل هذا الكشك.');
        else if (newStatus === 'inactive') setKioskMessage('هذا الكشك غير نشط حالياً. يرجى التواصل مع الإدارة.');
        else if (newStatus === 'maintenance') setKioskMessage('الكشك قيد الصيانة. نعتذر عن الإزعاج.');
        else setKioskMessage('');
      })
      .subscribe();

    const categoryChannel = supabase
      .channel('category-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donation_categories' }, () => { loadCategories(); })
      .subscribe();

    return () => {
      supabase.removeChannel(kioskChannel);
      supabase.removeChannel(categoryChannel);
    };
  }, []);

  const checkKioskStatus = async () => {
    try {
      const kioskId = localStorage.getItem('kiosk_id');
      if (!kioskId) {
        setKioskStatus('unregistered');
        setKioskMessage('يرجى تسجيل هذا الكشك من خلال لوحة الإعدادات للبدء.');
        return;
      }
      const { data, error } = await supabase.from('kiosks').select('status').eq('id', kioskId).maybeSingle();
      if (error) throw error;
      if (!data) {
        setKioskStatus('disconnected');
        setKioskMessage('تم فصل هذا الكشك من النظام. يرجى التواصل مع الإدارة.');
        return;
      }
      setKioskStatus(data.status);
      if (data.status === 'pending_approval') setKioskMessage('في انتظار الموافقة من الإدارة على تفعيل هذا الكشك.');
      else if (data.status === 'inactive') setKioskMessage('هذا الكشك غير نشط حالياً. يرجى التواصل مع الإدارة.');
      else if (data.status === 'maintenance') setKioskMessage('الكشك قيد الصيانة. نعتذر عن الإزعاج.');
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
      if (data && data.length > 0) await preloadImages(data);
      setCategories(data || []);

      const { data: settings } = await supabase.from('kiosk_settings').select('quranic_verse').limit(1).maybeSingle();
      if (settings?.quranic_verse) setQuranicVerse(settings.quranic_verse);
      else setQuranicVerse("وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ");
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    if (kioskStatus !== 'active') return;
    navigate(`/kiosk/preset-amounts?category=${categoryId}`);
  };

  const statusMessages: Record<string, { ar: string; en: string }> = {
    unregistered: { ar: 'تسجيل مطلوب', en: 'Registration Required' },
    pending_approval: { ar: 'في انتظار الموافقة', en: 'Pending Approval' },
    disconnected: { ar: 'خارج الخدمة', en: 'Out of Service' },
    maintenance: { ar: 'قيد الصيانة', en: 'Under Maintenance' },
    inactive: { ar: 'غير متاح حالياً', en: 'Currently Unavailable' },
  };

  const statusMessageEn: Record<string, string> = {
    'يرجى تسجيل هذا الكشك من خلال لوحة الإعدادات للبدء.': 'Please register this kiosk through the settings panel to get started.',
    'في انتظار الموافقة من الإدارة على تفعيل هذا الكشك.': 'Waiting for admin approval to activate this kiosk.',
    'هذا الكشك غير نشط حالياً. يرجى التواصل مع الإدارة.': 'This kiosk is currently inactive. Please contact administration.',
    'الكشك قيد الصيانة. نعتذر عن الإزعاج.': 'Kiosk is under maintenance. We apologize for the inconvenience.',
    'تم فصل هذا الكشك من النظام. يرجى التواصل مع الإدارة.': 'This kiosk has been disconnected. Please contact administration.',
  };

  return (
    <KioskLayout showHomeButton={false}>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-2 right-2 z-50 w-10 h-10 rounded-full bg-white border border-gray-300 hover:bg-gray-100"
        onClick={() => navigate('/kiosk/setup')}
      >
        <Settings className="w-5 h-5 text-gray-700" />
      </Button>

      {kioskStatus !== 'active' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-8">
          <Card className="max-w-2xl w-full p-12 text-center bg-white shadow-2xl">
            <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full shadow-lg flex items-center justify-center">
              {kioskStatus === 'unregistered' ? <Settings className="w-16 h-16 text-white" /> : <AlertTriangle className="w-16 h-16 text-white" />}
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              {statusMessages[kioskStatus]?.ar || 'غير متاح حالياً'}
            </h2>
            <p className="text-2xl text-gray-500 mb-6">
              {statusMessages[kioskStatus]?.en || 'Currently Unavailable'}
            </p>
            <p className="text-2xl text-gray-700 leading-relaxed mb-2">
              {kioskMessage}
            </p>
            <p className="text-xl text-gray-500 leading-relaxed mb-8">
              {statusMessageEn[kioskMessage] || ''}
            </p>
            {kioskStatus === 'unregistered' && (
              <Button size="lg" className="text-xl px-8 py-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/kiosk/setup')}>
                <Settings className="w-6 h-6 ml-2" />
                فتح لوحة الإعدادات
                <span className="text-base ml-2 opacity-80">Open Settings</span>
              </Button>
            )}
            {kioskStatus !== 'unregistered' && (
              <div className="mt-4">
                <p className="text-lg text-gray-600">نشكر لكم تفهمكم</p>
                <p className="text-base text-gray-400">Thank you for your understanding</p>
              </div>
            )}
          </Card>
        </div>
      )}
      
      <div
        className="w-full max-w-6xl mx-auto"
        style={{
          opacity: kioskStatus !== 'active' ? 0.5 : 1,
          pointerEvents: kioskStatus !== 'active' ? 'none' : 'auto'
        }}
      >
        <div className="text-center mb-6">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-md border-0 mb-4">
            <p className="text-xl font-bold text-gray-800 leading-relaxed">
              "{quranicVerse || "وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ"}"
            </p>
            <p className="text-sm text-emerald-700 mt-2 font-semibold">
              القرآن الكريم - سورة البقرة
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              The Holy Quran - Surah Al-Baqarah
            </p>
          </div>

          <h1 className="text-2xl font-bold mb-1 text-gray-900 drop-shadow-lg">نظام التبرعات الرقمي</h1>
          <p className="text-base text-gray-600 mb-2">Digital Donation System</p>
          <p className="text-lg text-gray-900 font-semibold drop-shadow">
            اختر نوع التبرع الذي ترغب في المساهمة به
          </p>
          <p className="text-sm text-gray-600">
            Choose the type of donation you would like to contribute
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {loading || !imagesPreloaded ? (
            <div className="col-span-2 text-center text-lg text-white/90">
              جاري التحميل...
              <p className="text-sm text-white/70">Loading...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-2 text-center text-lg text-white/80">
              لا توجد فئات متاحة حالياً
              <p className="text-sm text-white/60">No categories available</p>
            </div>
          ) : (
            categories.map((category) => (
              <Card
                key={category.id}
                className="p-0 overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 group relative min-h-[160px]"
              >
                {(category.info_text || category.description) && (
                  <div className="absolute top-2 right-2 z-10">
                    <CategoryInfoDialog title={category.title} description={category.description} infoText={category.info_text} />
                  </div>
                )}
                <KioskButton
                  variant="donation"
                  soundEffect="category"
                  className="w-full h-full flex flex-col items-center justify-center space-y-1 border-0 rounded-xl bg-transparent hover:bg-emerald-50/60"
                  onClick={() => handleCategorySelect(category.category_id)}
                >
                  <div className="w-12 h-12 mb-1 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center">
                    {category.icon_url && (
                      <img src={category.icon_url} alt={category.title} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {category.title}
                  </h3>
                  {category.title_en && (
                    <p className="text-sm text-gray-600 group-hover:text-emerald-600 transition-colors">
                      {category.title_en}
                    </p>
                  )}
                </KioskButton>
              </Card>
            ))
          )}
        </div>

        <div className="text-center">
          <p className="text-white/90 text-base font-semibold drop-shadow">
            المس الشاشة لاختيار نوع التبرع
          </p>
          <p className="text-white/70 text-sm">
            Touch the screen to select a donation type
          </p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default KioskHomepage;
