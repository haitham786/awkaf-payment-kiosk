import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Full-screen interstitial shown immediately after the donor confirms a
 * hardware-POS donation. The POS sale is dispatched in the background by the
 * payment page; this screen only masks the ~3 second interval while the
 * terminal wakes up and displays the amount.
 */
export const ConnectingPosScreen: React.FC = () => {
  const [backgroundImage, setBackgroundImage] = useState<string>(
    () => localStorage.getItem("kiosk_background_url") || "",
  );
  const [logoImage, setLogoImage] = useState<string>(
    () => localStorage.getItem("kiosk_logo_url") || "",
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from("kiosk_settings")
          .select("background_image_url, logo_url")
          .limit(1)
          .maybeSingle();
        if (data?.background_image_url) {
          localStorage.setItem("kiosk_background_url", data.background_image_url);
          setBackgroundImage(data.background_image_url);
        }
        if (data?.logo_url) {
          localStorage.setItem("kiosk_logo_url", data.logo_url);
          setLogoImage(data.logo_url);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f5f5f5",
      }}
    >
      {/* Logo — identical position/size to KioskLayout */}
      <div className="relative z-10 w-full flex justify-center items-center pt-2 pb-2 min-h-[64px] shrink-0">
        {logoImage && (
          <img
            src={logoImage}
            alt="Organization Logo"
            className="h-12 w-auto object-contain max-w-[220px]"
          />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-3 text-center">
        <div
          className="h-16 w-16 rounded-full border-4 border-gray-900/20 border-t-gray-900 animate-spin"
          role="status"
          aria-label="Connecting with POS Device"
        />
        <h2 className="mt-5 whitespace-nowrap text-[15px] font-bold leading-tight text-gray-900">
          يجري الاتصال مع جهاز الدفع الإلكتروني
        </h2>
        <p className="mt-2 text-sm text-gray-700">Connecting with POS Device</p>
      </div>
    </div>
  );
};
