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
      const {
        data,
        error
      } = await supabase.from('kiosks').select('status').eq('id', kioskId).single();
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
      const {
        data,
        error
      } = await supabase.from('donation_categories').select('*').eq('is_visible', true).order('display_order', {
        ascending: true
      });
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
  return <KioskLayout showHomeButton={false}>
      {/* Setup button in top-right corner */}
      <Button variant="ghost" size="icon" className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full bg-card/50 backdrop-blur-md border-2 border-primary/30 hover:bg-card/80" onClick={() => navigate('/kiosk/setup')}>
        <Settings className="w-6 h-6 text-primary" />
      </Button>

      {/* Status Alert */}
      {kioskStatus !== 'active' && <div className="w-full max-w-6xl mx-auto mb-8">
          <Alert className="bg-destructive/20 border-destructive/50">
            <AlertTriangle className="h-6 w-6" />
            <AlertDescription className="text-lg text-right font-semibold">
              {kioskMessage}
            </AlertDescription>
          </Alert>
        </div>}
      
      <div className="w-full max-w-6xl mx-auto" style={{
      opacity: kioskStatus !== 'active' ? 0.5 : 1,
      pointerEvents: kioskStatus !== 'active' ? 'none' : 'auto'
    }}>
        {/* Header */}
        <div className="text-center mb-12">
          {/* Futuristic Logo with static glow */}
          <div className="w-40 h-40 mx-auto mb-8 bg-gradient-primary rounded-full shadow-neon flex items-center justify-center relative border-4 border-primary/30">
            <div className="absolute inset-0 rounded-full bg-gradient-neon opacity-20 blur-xl"></div>
            <span className="text-5xl relative z-10">🕌</span>
          </div>
          
          {/* Quranic verse with neon border */}
          <div className="bg-card/30 backdrop-blur-xl rounded-2xl p-8 shadow-neon border-2 border-primary/40 mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5"></div>
            <p className="text-3xl font-bold text-foreground leading-relaxed relative z-10">
              "وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ"
            </p>
            <p className="text-lg text-primary mt-3 relative z-10 font-semibold">
              القرآن الكريم - سورة البقرة
            </p>
          </div>

          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-slate-950">نظام التبرعات الرقمي</h1>
          <p className="text-xl text-primary font-semibold">
            اختر نوع التبرع الذي ترغب في المساهمة به
          </p>
        </div>

        {/* Donation Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {loading ? <div className="col-span-2 md:col-span-3 text-center text-xl text-primary">
              جاري التحميل...
            </div> : categories.length === 0 ? <div className="col-span-2 md:col-span-3 text-center text-xl text-muted-foreground">
              لا توجد فئات متاحة حالياً
            </div> : categories.map((category, index) => <Card key={category.id} className="p-0 overflow-hidden bg-card/20 backdrop-blur-md border-2 border-primary/30 shadow-card hover:shadow-neon transition-all duration-300 hover:scale-105 transform-3d group relative min-h-[200px]">
              <CategoryInfoDialog title={category.title} description={category.description} infoText={category.info_text || ''} />
              <KioskButton variant="donation" className="w-full h-full flex flex-col items-center justify-center space-y-3 border-0 rounded-xl" onClick={() => handleCategorySelect(category.category_id)} style={{
            animationDelay: `${index * 0.1}s`
          }}>
                {category.icon_url ? <div className="w-16 h-16 mb-3 group-hover:scale-125 transition-transform duration-300">
                    <img src={category.icon_url} alt={category.title} className="w-full h-full object-contain" style={{
                filter: 'drop-shadow(0 0 10px hsl(180 100% 50% / 0.5))'
              }} />
                  </div> : <div className="text-5xl mb-3 group-hover:scale-125 transition-transform duration-300" style={{
              filter: 'drop-shadow(0 0 10px hsl(180 100% 50% / 0.5))'
            }}>📿</div>}
                <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{category.title}</h3>
              </KioskButton>
            </Card>)}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-primary text-lg font-semibold">
            المس الشاشة لاختيار نوع التبرع
          </p>
        </div>
      </div>
    </KioskLayout>;
};
export default KioskHomepage;