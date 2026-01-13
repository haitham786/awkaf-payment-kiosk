import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryInfoDialog } from "@/components/kiosk/CategoryInfoDialog";

const KioskHomepage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quranicVerse, setQuranicVerse] = useState<string>("");
  // Initialize status based on localStorage to prevent flashing
  const [kioskStatus, setKioskStatus] = useState<'active' | 'inactive' | 'maintenance' | 'pending_approval' | 'disconnected' | 'unregistered'>(() => {
    const kioskId = localStorage.getItem('kiosk_id');
    return kioskId ? 'active' : 'unregistered';
  });
  const [kioskMessage, setKioskMessage] = useState('');

  useEffect(() => {
    checkKioskStatus();
    loadCategories();

    const kioskId = localStorage.getItem('kiosk_id');
    const channels: any[] = [];

    // Subscribe to this kiosk's status changes only if the kiosk is registered.
    // IMPORTANT: Passing an undefined filter can crash realtime subscriptions in some environments.
    if (kioskId) {
      const kioskChannel = supabase
        .channel(`kiosk-changes:${kioskId}`)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'kiosks',
            filter: `id=eq.${kioskId}`,
          },
          () => {
            setKioskStatus('disconnected');
            setKioskMessage('تم فصل هذا الكشك من النظام. يرجى التواصل مع الإدارة.');
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'kiosks',
            filter: `id=eq.${kioskId}`,
          },
          (payload) => {
            const newStatus = payload.new.status;
            setKioskStatus(newStatus);
            if (newStatus === 'pending_approval') {
              setKioskMessage('في انتظار الموافقة من الإدارة على تفعيل هذا الكشك.');
            } else if (newStatus === 'inactive') {
              setKioskMessage('هذا الكشك غير نشط حالياً. يرجى التواصل مع الإدارة.');
            } else if (newStatus === 'maintenance') {
              setKioskMessage('الكشك قيد الصيانة. نعتذر عن الإزعاج.');
            } else {
              setKioskMessage('');
            }
          }
        )
        .subscribe();

      channels.push(kioskChannel);
    }

    // Real-time subscription for category changes
    const categoryChannel = supabase
      .channel('category-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'donation_categories',
        },
        () => {
          // Reload categories on any change (INSERT, UPDATE, DELETE)
          loadCategories();
        }
      )
      .subscribe();

    channels.push(categoryChannel);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
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

      const { data, error } = await supabase
        .from('kiosks')
        .select('status')
        .eq('id', kioskId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Kiosk was deleted
        setKioskStatus('disconnected');
        setKioskMessage('تم فصل هذا الكشك من النظام. يرجى التواصل مع الإدارة.');
        return;
      }

      setKioskStatus(data.status);
      if (data.status === 'pending_approval') {
        setKioskMessage('في انتظار الموافقة من الإدارة على تفعيل هذا الكشك.');
      } else if (data.status === 'inactive') {
        setKioskMessage('هذا الكشك غير نشط حالياً. يرجى التواصل مع الإدارة.');
      } else if (data.status === 'maintenance') {
        setKioskMessage('الكشك قيد الصيانة. نعتذر عن الإزعاج.');
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
      
      // Load Quranic verse from kiosk_settings
      const { data: settings } = await supabase
        .from('kiosk_settings')
        .select('quranic_verse')
        .limit(1)
        .maybeSingle();
      
      if (settings?.quranic_verse) {
        setQuranicVerse(settings.quranic_verse);
      } else {
        setQuranicVerse("وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ");
      }
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

      {/* Out of Service Overlay */}
      {kioskStatus !== 'active' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-8">
          <Card className="max-w-2xl w-full p-12 text-center bg-white shadow-2xl">
            <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full shadow-lg flex items-center justify-center">
              {kioskStatus === 'unregistered' ? (
                <Settings className="w-16 h-16 text-white" />
              ) : (
                <AlertTriangle className="w-16 h-16 text-white" />
              )}
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              {kioskStatus === 'unregistered' ? 'تسجيل مطلوب' : 
               kioskStatus === 'pending_approval' ? 'في انتظار الموافقة' :
               kioskStatus === 'disconnected' ? 'خارج الخدمة' : 
               kioskStatus === 'maintenance' ? 'قيد الصيانة' : 'غير متاح حالياً'}
            </h2>
            <p className="text-2xl text-gray-700 leading-relaxed mb-8">
              {kioskMessage}
            </p>
            {kioskStatus === 'unregistered' && (
              <Button
                size="lg"
                className="text-xl px-8 py-6 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => navigate('/kiosk/setup')}
              >
                <Settings className="w-6 h-6 ml-2" />
                فتح لوحة الإعدادات
              </Button>
            )}
            {kioskStatus !== 'unregistered' && (
              <div className="mt-4 text-lg text-gray-600">
                نشكر لكم تفهمكم
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
        {/* Header */}
        <div className="text-center mb-6">
          {/* Quranic verse */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-md border-0 mb-4">
            <p className="text-xl font-bold text-gray-800 leading-relaxed">
              "{quranicVerse || "وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ"}"
            </p>
            <p className="text-sm text-emerald-700 mt-2 font-semibold">
              القرآن الكريم - سورة البقرة
            </p>
          </div>

          <h1 className="text-2xl font-bold mb-2 text-gray-900 drop-shadow-lg">نظام التبرعات الرقمي</h1>
          <p className="text-lg text-gray-900 font-semibold drop-shadow">
            اختر نوع التبرع الذي ترغب في المساهمة به
          </p>
        </div>

        {/* Donation Categories Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {loading ? (
            <div className="col-span-2 text-center text-lg text-white/90">
              جاري التحميل...
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-2 text-center text-lg text-white/80">
              لا توجد فئات متاحة حالياً
            </div>
          ) : (
            categories.map((category) => (
              <Card
                key={category.id}
                className="p-0 overflow-hidden bg-white/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 group relative min-h-[140px]"
              >
                {(category.info_text || category.description) && (
                  <div className="absolute top-2 right-2 z-10">
                    <CategoryInfoDialog
                      title={category.title}
                      description={category.description}
                      infoText={category.info_text}
                    />
                  </div>
                )}
                <KioskButton
                  variant="donation"
                  soundEffect="category"
                  className="w-full h-full flex flex-col items-center justify-center space-y-2 border-0 rounded-xl bg-transparent hover:bg-emerald-50/60"
                  onClick={() => handleCategorySelect(category.category_id)}
                >
                  {category.icon_url && (
                    <div className="w-12 h-12 mb-1 group-hover:scale-110 transition-transform duration-300">
                      <img
                        src={category.icon_url}
                        alt={category.title}
                        className="w-full h-full object-contain"
                        loading="eager"
                      />
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
          <p className="text-white/90 text-base font-semibold drop-shadow">
            المس الشاشة لاختيار نوع التبرع
          </p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default KioskHomepage;
