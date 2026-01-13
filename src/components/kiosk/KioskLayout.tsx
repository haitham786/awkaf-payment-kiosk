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
    // Initialize from localStorage to prevent flashing
    return localStorage.getItem('kiosk_background_url') || "";
  });
  const [logoImage, setLogoImage] = useState<string>(() => {
    // Initialize from localStorage to prevent flashing
    return localStorage.getItem('kiosk_logo_url') || "";
  });
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

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
        
        // Preload images before setting them
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
        
        // Store in localStorage for instant access on next load
        if (bgUrl) {
          localStorage.setItem('kiosk_background_url', bgUrl);
          setBackgroundImage(bgUrl);
        }
        if (logoUrl) {
          localStorage.setItem('kiosk_logo_url', logoUrl);
          setLogoImage(logoUrl);
        }
        
        setImagesPreloaded(true);
      }
    } catch (error) {
      console.error("Error preloading images:", error);
      setImagesPreloaded(true);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-start p-6 relative islamic-pattern"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >

      {/* Logo at top center - Always reserve space for stability */}
      <div className="relative z-10 w-full flex justify-center pt-4 pb-2 min-h-[72px]">
        {logoImage && (
          <img 
            src={logoImage} 
            alt="Organization Logo" 
            className="h-14 w-auto object-contain max-w-[200px]"
          />
        )}
      </div>
      
      {/* Content - proper spacing below logo */}
      <div className="relative z-10 w-full max-w-6xl flex-1 flex items-center justify-center pt-2">
        {children}
      </div>

      {/* Home Button */}
      {showHomeButton && (
        <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-20">
          <KioskButton
            variant="ghost"
            size="lg"
            soundEffect="navigation"
            onClick={() => navigate("/kiosk")}
            className="bg-transparent hover:bg-white/10 backdrop-blur-sm shadow-none border-0 p-3"
          >
            <Home className="w-8 h-8 text-white drop-shadow-lg" />
          </KioskButton>
        </div>
      )}
    </div>
  );
};