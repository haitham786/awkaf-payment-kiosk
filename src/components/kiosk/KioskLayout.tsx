import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { supabase } from "@/integrations/supabase/client";

interface KioskLayoutProps {
  children: React.ReactNode;
  showHomeButton?: boolean;
}

export const KioskLayout = ({ children, showHomeButton = true }: KioskLayoutProps) => {
  const navigate = useNavigate();
  const [backgroundImage, setBackgroundImage] = useState<string>(() => {
    return localStorage.getItem('kiosk_background_url') || "";
  });
  const [logoImage, setLogoImage] = useState<string>(() => {
    return localStorage.getItem('kiosk_logo_url') || "";
  });
  useEffect(() => {
    preloadImages();
  }, []);

  const preloadImages = async () => {
    try {
      const { data, error } = await supabase
        .from("kiosk_settings")
        .select("background_image_url, logo_url")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        const bgUrl = data.background_image_url || "";
        const logoUrl = data.logo_url || "";
        
        const promises = [];
        
        if (bgUrl) {
          const bgImg = new Image();
          bgImg.src = bgUrl;
          promises.push(
            new Promise((resolve) => {
              bgImg.onload = resolve;
              bgImg.onerror = resolve;
            })
          );
        }
        
        if (logoUrl) {
          const logoImg = new Image();
          logoImg.src = logoUrl;
          promises.push(
            new Promise((resolve) => {
              logoImg.onload = resolve;
              logoImg.onerror = resolve;
            })
          );
        }
        
        await Promise.all(promises);
        
        if (bgUrl) {
          localStorage.setItem('kiosk_background_url', bgUrl);
          setBackgroundImage(bgUrl);
        }
        if (logoUrl) {
          localStorage.setItem('kiosk_logo_url', logoUrl);
          setLogoImage(logoUrl);
        }
        
      }
    } catch (error) {
      console.error("Error preloading images:", error);
    }
  };

  return (
    <div 
      className="h-screen flex flex-col items-center justify-start p-3 relative islamic-pattern overflow-hidden"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >

      {/* Logo at top center */}
      <div className="relative z-10 w-full flex justify-center items-center pt-2 pb-2 min-h-[64px] shrink-0">
        {logoImage && (
          <img 
            src={logoImage} 
            alt="Organization Logo" 
            className="h-12 w-auto object-contain max-w-[220px]"
          />
        )}
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl flex-1 flex items-center justify-center overflow-hidden">
        {children}
      </div>

      {/* Home Button */}
      {showHomeButton && (
        <div className="fixed bottom-3 left-1/2 transform -translate-x-1/2 z-20">
          <KioskButton
            variant="ghost"
            size="sm"
            soundEffect="navigation"
            onClick={() => navigate("/kiosk")}
            className="bg-transparent hover:bg-white/10 backdrop-blur-sm shadow-none border-0 p-2"
          >
            <Home className="w-6 h-6 text-white drop-shadow-lg" />
          </KioskButton>
        </div>
      )}
    </div>
  );
};
