import React from "react";
import { useNavigate } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";

const KioskHomepage = () => {
  const navigate = useNavigate();

  // Mock donation categories - in real app, this would come from admin dashboard
  const donationCategories = [
    { id: 'zakat', title: 'زكاة', description: 'زكاة المال والذهب' },
    { id: 'sadaqah', title: 'صدقة', description: 'الصدقة العامة' },
    { id: 'charity', title: 'خيرية', description: 'الأعمال الخيرية' },
    { id: 'mosque', title: 'مسجد', description: 'دعم المسجد' },
    { id: 'orphans', title: 'أيتام', description: 'كفالة الأيتام' },
    { id: 'education', title: 'تعليم', description: 'دعم التعليم' },
  ];

  const handleCategorySelect = (categoryId: string) => {
    navigate(`/kiosk/amount?category=${categoryId}`);
  };

  return (
    <KioskLayout showHomeButton={false}>
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          {/* Logo placeholder */}
          <div className="w-32 h-32 mx-auto mb-6 bg-gradient-primary rounded-full shadow-elegant flex items-center justify-center">
            <span className="text-4xl text-primary-foreground">🕌</span>
          </div>
          
          {/* Quranic verse placeholder */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-card border border-primary/20 mb-8">
            <p className="text-2xl font-semibold text-foreground leading-relaxed">
              "وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ"
            </p>
            <p className="text-lg text-muted-foreground mt-2">
              القرآن الكريم - سورة البقرة
            </p>
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-4">
            مرحباً بكم في نظام التبرعات الذكي
          </h1>
          <p className="text-xl text-muted-foreground">
            اختر نوع التبرع الذي ترغب في المساهمة به
          </p>
        </div>

        {/* Donation Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {donationCategories.map((category) => (
            <Card key={category.id} className="p-0 overflow-hidden bg-gradient-card border border-primary/20 shadow-card hover:shadow-elegant transition-all duration-300">
              <KioskButton
                variant="donation"
                className="w-full h-full flex flex-col items-center justify-center space-y-3 border-0 rounded-lg"
                onClick={() => handleCategorySelect(category.id)}
              >
                <div className="text-4xl mb-2">📿</div>
                <h3 className="text-2xl font-bold">{category.title}</h3>
                <p className="text-sm text-center opacity-80">{category.description}</p>
              </KioskButton>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            المس الشاشة لاختيار نوع التبرع
          </p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default KioskHomepage;