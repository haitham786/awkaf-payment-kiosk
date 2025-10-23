import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useScreenSize } from "@/hooks/useScreenSize";

interface KioskLayoutProps {
  children: React.ReactNode;
  showHomeButton?: boolean;
  className?: string;
  arabic?: boolean;
}

export const KioskLayout: React.FC<KioskLayoutProps> = ({
  children,
  showHomeButton = true,
  className,
  arabic = true,
}) => {
  const navigate = useNavigate();
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const { profile, scaleFactor, isKiosk } = useScreenSize();

  useEffect(() => {
    loadBackgroundImage();
  }, []);

  const loadBackgroundImage = async () => {
    try {
      const { data, error } = await supabase
        .from('kiosk_settings')
        .select('background_image_url')
        .single();

      if (error) throw error;
      if (data?.background_image_url) {
        setBackgroundImage(data.background_image_url);
      }
    } catch (error) {
      console.error('Error loading background image:', error);
    }
  };

  return (
    <div 
      className={cn(
        "min-h-screen w-full bg-white relative overflow-hidden",
        arabic ? "rtl" : "ltr",
        className
      )}
      style={{
        fontSize: `${scaleFactor}rem`
      }}
    >
      {/* Background Image */}
      {backgroundImage && (
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      )}
      
      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <main 
          className="flex-1 flex items-center justify-center"
          style={{
            padding: `${profile === 'kiosk-fhd' ? '1.5rem' : '1rem'}`
          }}
        >
          {children}
        </main>
        
        {/* Home button - Floating icon without frame */}
        {showHomeButton && (
          <button
            onClick={() => navigate("/kiosk")}
            className={cn(
              "fixed z-50 pb-safe p-4 rounded-full bg-primary/90 hover:bg-primary shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95",
              arabic ? "left-6" : "right-6"
            )}
            style={{
              bottom: `${profile === 'kiosk-fhd' ? '2.5rem' : '2rem'}`
            }}
            aria-label={arabic ? "الرئيسية" : "Home"}
          >
            <Home className="w-8 h-8 text-primary-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};