import React from "react";
import { useNavigate } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
const KioskHomepage = () => {
  const navigate = useNavigate();

  // Mock donation categories - in real app, this would come from admin dashboard
  const donationCategories = [{
    id: 'ashura',
    title: 'تبرعات عاشوراء',
    description: 'التبرعات الخاصة بعاشوراء'
  }, {
    id: 'ramadan',
    title: 'إفطار شهر رمضان',
    description: 'إفطار الصائمين'
  }, {
    id: 'zakat',
    title: 'زكاة',
    description: 'زكاة المال والذهب'
  }, {
    id: 'sadaqah',
    title: 'صدقة',
    description: 'الصدقة العامة'
  }, {
    id: 'charity',
    title: 'خيرية',
    description: 'الأعمال الخيرية'
  }, {
    id: 'mosque',
    title: 'تبرعات للمآتم',
    description: 'دعم المآتم'
  }, {
    id: 'orphans',
    title: 'أيتام',
    description: 'كفالة الأيتام'
  }, {
    id: 'education',
    title: 'نشاط التدريس',
    description: 'دعم التعليم'
  }];
  const handleCategorySelect = (categoryId: string) => {
    navigate(`/kiosk/amount?category=${categoryId}`);
  };
  return <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-6xl mx-auto">
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

          <h1 className="text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            مرحباً بكم في نظام التبرعات الذكي
          </h1>
          <p className="text-xl text-primary font-semibold">
            اختر نوع التبرع الذي ترغب في المساهمة به
          </p>
        </div>

        {/* Donation Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {donationCategories.map((category, index) => <Card key={category.id} className="p-0 overflow-hidden bg-card/20 backdrop-blur-md border-2 border-primary/30 shadow-card hover:shadow-neon transition-all duration-300 hover:scale-105 transform-3d group">
              <KioskButton variant="donation" className="w-full h-full flex flex-col items-center justify-center space-y-3 border-0 rounded-xl relative" onClick={() => handleCategorySelect(category.id)} style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <div className="text-5xl mb-3 group-hover:scale-125 transition-transform duration-300" style={{
              filter: 'drop-shadow(0 0 10px hsl(180 100% 50% / 0.5))'
            }}>📿</div>
                <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{category.title}</h3>
                <p className="text-sm text-center text-muted-foreground group-hover:text-primary/80 transition-colors">{category.description}</p>
                
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