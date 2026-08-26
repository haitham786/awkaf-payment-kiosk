import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryInfoDialog } from "@/components/kiosk/CategoryInfoDialog";
import { primeCategoryCache, readCachedCategories } from "@/lib/kioskCategoryCache";
import { persistPaymentMode } from "@/lib/kioskConfig";
import { warmHardwarePos } from "@/lib/hardwarePosWarm";

const SETTINGS_CACHE_KEY = "kiosk_home_settings";

const readCachedSettings = () => {
  const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
  if (!cached) return null as { quranic_verse?: string; quranic_verse_surah?: string } | null;

  try {
    return JSON.parse(cached) as { quranic_verse?: string; quranic_verse_surah?: string };
  } catch {
    return null;
  }
};

const KioskHomepage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>(() => readCachedCategories());
  const [loading, setLoading] = useState(() => readCachedCategories().length === 0);
  const cachedSettings = readCachedSettings();
  const [quranicVerse, setQuranicVerse] = useState<string>(() => cachedSettings?.quranic_verse || "");
  const [quranicVerseSurah, setQuranicVerseSurah] = useState<string>(() => cachedSettings?.quranic_verse_surah || "");
  const [kioskStatus, setKioskStatus] = useState<'active' | 'inactive' | 'maintenance' | 'pending_approval' | 'disconnected' | 'unregistered'>(() => {
    const kioskId = localStorage.getItem('kiosk_id');
    return kioskId ? 'active' : 'unregistered';
  });
  const [kioskMessage, setKioskMessage] = useState('');

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
      const { data, error } = await supabase.functions.invoke('get-kiosk-config', { body: { kioskId } });
      if (error) throw error;
      if (!data?.kiosk) {
        setKioskStatus('disconnected');
        setKioskMessage('تم فصل هذا الكشك من النظام. يرجى التواصل مع الإدارة.');
        return;
      }
      persistPaymentMode(kioskId, data.kiosk.configuration?.payment_mode);
      if (data.kiosk.configuration?.payment_mode === 'hardware_pos') {
        void warmHardwarePos(true);
      }
      setKioskStatus(data.kiosk.status);
      if (data.kiosk.status === 'pending_approval') setKioskMessage('في انتظار الموافقة من الإدارة على تفعيل هذا الكشك.');
      else if (data.kiosk.status === 'inactive') setKioskMessage('هذا الكشك غير نشط حالياً. يرجى التواصل مع الإدارة.');
      else if (data.kiosk.status === 'maintenance') setKioskMessage('الكشك قيد الصيانة. نعتذر عن الإزعاج.');
    } catch (error) {
      console.error('Error checking kiosk status:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const [catResult, settingsResult] = await Promise.all([
        supabase.from('donation_categories').select('*').eq('is_visible', true).order('display_order', { ascending: true }),
        supabase.from('kiosk_settings').select('quranic_verse, quranic_verse_surah').limit(1).maybeSingle()
      ]);

      if (catResult.error) throw catResult.error;
      const nextCategories = catResult.data || [];
      setCategories(nextCategories);
      primeCategoryCache(nextCategories);

      const nextSettings = {
        quranic_verse: settingsResult.data?.quranic_verse || "",
        quranic_verse_surah: (settingsResult.data as any)?.quranic_verse_surah || "",
      };

      setQuranicVerse(nextSettings.quranic_verse);
      setQuranicVerseSurah(nextSettings.quranic_verse_surah);
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(nextSettings));
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
        className="fixed top-2 right-2 z-50 w-8 h-8 rounded-full bg-white border border-gray-300 hover:bg-gray-100"
        onClick={() => navigate('/kiosk/setup')}
      >
        <Settings className="w-4 h-4 text-gray-700" />
      </Button>

      {kioskStatus !== 'active' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6 text-center bg-white/70 backdrop-blur-md shadow-2xl border border-white/40">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full shadow-lg flex items-center justify-center">
              {kioskStatus === 'unregistered' ? <Settings className="w-10 h-10 text-white" /> : <AlertTriangle className="w-10 h-10 text-white" />}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {statusMessages[kioskStatus]?.en || 'Currently Unavailable'}
            </h2>
            <p className="text-base text-gray-700 leading-relaxed mb-4">
              {statusMessageEn[kioskMessage] || ''}
            </p>
            {kioskStatus === 'unregistered' && (
              <Button size="default" className="text-sm px-4 py-2 max-w-[250px] w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/kiosk/setup')}>
                <Settings className="w-4 h-4 mr-1 flex-shrink-0" />
                <span>Settings</span>
              </Button>
            )}
            {kioskStatus !== 'unregistered' && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">Thank you for your understanding</p>
              </div>
            )}
          </Card>
        </div>
      )}
      
      <div
        className="w-full max-w-6xl mx-auto flex flex-col h-full"
        style={{
          opacity: kioskStatus !== 'active' ? 0.5 : 1,
          pointerEvents: kioskStatus !== 'active' ? 'none' : 'auto'
        }}
      >
        <div className="text-center mb-1 shrink-0">
          {quranicVerse && (
            <div className="rounded-xl p-1 mb-1">
              <p className="text-sm font-bold text-gray-800 leading-relaxed drop-shadow-sm">
                "{quranicVerse}"
              </p>
              {quranicVerseSurah && (
                <p className="text-xs text-emerald-700 mt-0.5 font-semibold">
                  سورة {quranicVerseSurah}
                </p>
              )}
            </div>
          )}

          <p className="text-base text-gray-900 font-bold drop-shadow mb-0.5">
            اختر نوع التبرع
          </p>
          <p className="text-sm text-gray-600 font-bold">
            Choose the category of donation
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2 flex-1 min-h-0 content-start">
          {loading ? (
            <div className="col-span-2 text-center text-base text-white/90">
              جاري التحميل...
              <p className="text-xs text-white/70">Loading...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-2 text-center text-base text-white/80">
              لا توجد فئات متاحة حالياً
              <p className="text-xs text-white/60">No categories available</p>
            </div>
          ) : (
            categories.map((category) => (
              <Card
                key={category.id}
                className="p-0 overflow-hidden bg-white/40 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 group relative"
              >
                {(category.info_text || category.description || category.info_text_en || category.description_en) && (
                  <div className="absolute top-1 right-1 z-10">
                    <CategoryInfoDialog
                      title={category.title}
                      titleEn={category.title_en}
                      description={category.description}
                      descriptionEn={category.description_en}
                      infoText={category.info_text}
                      infoTextEn={category.info_text_en}
                    />
                  </div>
                )}
                <KioskButton
                  variant="donation"
                  soundEffect="category"
                  className="w-full h-full flex flex-col items-center justify-center py-2 space-y-0.5 border-0 rounded-xl bg-transparent hover:bg-emerald-50/60"
                  onClick={() => handleCategorySelect(category.category_id)}
                >
                  <div className="w-10 h-10 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center">
                    {category.icon_url && (
                      <img src={category.icon_url} alt={category.title} className="w-full h-full object-contain" loading="eager" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors leading-tight">
                    {category.title}
                  </h3>
                  {category.title_en && (
                    <p className="text-xs text-gray-600 group-hover:text-emerald-600 transition-colors leading-tight">
                      {category.title_en}
                    </p>
                  )}
                </KioskButton>
              </Card>
            ))
          )}
        </div>

        <div className="shrink-0 pb-8 pt-1">
          <div className="flex justify-center items-center gap-3 flex-wrap">
            <img src="/images/payment-logos/visa.svg" alt="Visa" className="h-5 w-auto object-contain" />
            <img src="/images/payment-logos/mastercard.svg" alt="Mastercard" className="h-5 w-auto object-contain" />
            <img src="/images/payment-logos/omannet.svg" alt="OmanNet" className="h-6 w-auto object-contain" />
            <img src="/images/payment-logos/mal.svg" alt="Mal" className="h-6 w-auto object-contain" />
          </div>
        </div>
      </div>
    </KioskLayout>
  );
};

export default KioskHomepage;
