import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNativePlatform } from "@/utils/capacitorUtils";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      // Check if running as mobile app or web browser
      if (isNativePlatform()) {
        // Mobile app - redirect to kiosk
        navigate('/kiosk');
      } else {
        // Web browser - redirect to admin login
        navigate('/auth');
      }
    } catch (error) {
      console.error('[Index] Error detecting platform:', error);
      // Default to auth page on error
      navigate('/auth');
    }
  }, [navigate]);

  return null;
};

export default Index;
