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
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [logoImage, setLogoImage] = useState<string>("");

  useEffect(() => {
    loadBackgroundImage();
    loadLogoImage();
  }, []);

  const loadBackgroundImage = async () => {
    try {
      const { data, error } = await supabase
        .from("kiosk_settings")
        .select("background_image_url")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.background_image_url) {
        setBackgroundImage(data.background_image_url);
      }
    } catch (error) {
      console.error("Error loading background image:", error);
    }
  };

  const loadLogoImage = async () => {
    try {
      const { data, error } = await supabase
        .from("kiosk_settings")
        .select("logo_url")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data && (data as any).logo_url) {
        setLogoImage((data as any).logo_url);
      }
    } catch (error) {
      console.error("Error loading logo image:", error);
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
      }}
    >
      {/* Background overlay removed to show original image colors */}

      {/* Logo at top center */}
      {logoImage && (
        <div className="relative z-10 w-full flex justify-center pt-4 pb-2">
          <img 
            src={logoImage} 
            alt="Organization Logo" 
            className="h-16 w-auto object-contain"
          />
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl flex-1 flex items-center justify-center">
        {children}
      </div>

      {/* Home Button */}
      {showHomeButton && (
        <div className="fixed bottom-6 left-6 z-20">
          <KioskButton
            variant="secondary"
            size="lg"
            soundEffect="navigation"
            onClick={() => navigate("/kiosk")}
            className="bg-white/80 hover:bg-white/90 backdrop-blur-sm shadow-lg border-0"
          >
            <Home className="w-6 h-6" />
          </KioskButton>
        </div>
      )}
    </div>
  );
};