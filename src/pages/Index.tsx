import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect directly to kiosk interface
    navigate('/kiosk');
  }, [navigate]);

  return null;
};

export default Index;
