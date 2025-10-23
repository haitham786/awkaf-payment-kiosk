import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showAlert, setShowAlert] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowAlert(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showAlert) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] p-4 animate-fade-in">
      <Alert variant="destructive" className="max-w-2xl mx-auto shadow-2xl border-2">
        <WifiOff className="h-5 w-5" />
        <AlertDescription className="text-base font-semibold">
          No internet connection detected. Please check your network connection and try again.
        </AlertDescription>
      </Alert>
    </div>
  );
};
