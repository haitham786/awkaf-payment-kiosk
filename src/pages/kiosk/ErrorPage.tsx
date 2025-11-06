import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ErrorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const [categoryData, setCategoryData] = useState<{ title: string; icon_url: string | null } | null>(null);
  
  // Get error type from URL params or default to payment
  const errorType = searchParams.get('error') || 'payment';

  // Auto-navigate to home after 10 seconds of inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/kiosk');
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) return;
      
      try {
        const { data, error } = await supabase
          .from("donation_categories")
          .select("title, icon_url")
          .eq("id", categoryId)
          .single();

        if (error) throw error;
        
        if (data) {
          setCategoryData(data);
        }
      } catch (error) {
        console.error("Error loading category data:", error);
      }
    };

    loadCategoryData();
  }, [categoryId]);

  const getErrorMessage = () => {
    switch (errorType) {
      case 'network':
        return {
          title: "خطأ في الاتصال",
          description: "تعذر الاتصال بالشبكة، يرجى المحاولة مرة أخرى",
          icon: "🌐"
        };
      case 'card':
        return {
          title: "خطأ في البطاقة",
          description: "تعذر قراءة البطاقة، يرجى التأكد من البطاقة والمحاولة مرة أخرى",
          icon: "💳"
        };
      case 'insufficient':
        return {
          title: "رصيد غير كافٍ",
          description: "الرصيد في البطاقة غير كافٍ لإتمام العملية",
          icon: "💰"
        };
      case 'declined':
        return {
          title: "تم رفض العملية",
          description: "تم رفض العملية من البنك، يرجى التواصل مع البنك",
          icon: "❌"
        };
      default:
        return {
          title: "خطأ في الدفع",
          description: "حدث خطأ أثناء معالجة الدفع، يرجى المحاولة مرة أخرى",
          icon: "⚠️"
        };
    }
  };

  const formatAmount = (totalBaisas: number) => {
    const rials = Math.floor(totalBaisas / 1000);
    const baisas = totalBaisas % 1000;
    return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
  };

  const handleTryAgain = () => {
    navigate(`/kiosk/amount?category=${categoryId}`);
  };

  const errorInfo = getErrorMessage();

  return (
    <KioskLayout>
      <div className="w-full max-w-3xl mx-auto space-y-4">
        {/* Category Header */}
        {categoryData && (
          <div className="text-center">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 shadow-md border-0">
              {categoryData.icon_url && (
                <div className="flex justify-center mb-2">
                  <img 
                    src={categoryData.icon_url} 
                    alt={categoryData.title}
                    className="w-12 h-12 object-contain"
                  />
                </div>
              )}
              <h2 className="text-lg font-bold text-gray-900">
                {categoryData.title}
              </h2>
            </div>
          </div>
        )}

        {/* Error Card */}
        <Card className="p-6 bg-white shadow-lg border-2 border-red-300 text-center">
          <div className="space-y-4">
            {/* Error Icon */}
            <div className="w-16 h-16 mx-auto bg-red-50 rounded-full shadow-md flex items-center justify-center border-2 border-red-300">
              <span className="text-3xl">{errorInfo.icon}</span>
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-red-600">
                {errorInfo.title}
              </h2>
            </div>

            {/* Transaction Details */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-base font-semibold mb-3 text-gray-900">
                تفاصيل العملية المتأثرة:
              </h3>
              <div className="text-center">
                <p className="text-gray-600 mb-1 text-sm">المبلغ</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatAmount(amount)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex justify-center mt-4">
          <KioskButton
            variant="confirm"
            size="xl"
            onClick={handleTryAgain}
            className="min-w-[240px] bg-white/80 hover:bg-white/90 backdrop-blur-sm text-gray-900 flex items-center justify-center border border-white/40"
          >
            <RefreshCw className="w-5 h-5 ml-2" />
            المحاولة مرة أخرى
          </KioskButton>
        </div>
      </div>
    </KioskLayout>
  );
};

export default ErrorPage;
