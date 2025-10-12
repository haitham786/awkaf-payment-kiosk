import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if running as mobile app or web browser
    if (Capacitor.isNativePlatform()) {
      // Mobile app - redirect to kiosk
      navigate('/kiosk');
    } else {
      // Web browser - redirect to admin login
      navigate('/auth');
    }
  }, [navigate]);

  return null;
};

export default Index;
