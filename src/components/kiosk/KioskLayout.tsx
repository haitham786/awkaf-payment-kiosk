import React from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { cn } from "@/lib/utils";

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

  return (
    <div className={cn(
      "min-h-screen w-full bg-white relative overflow-hidden",
      arabic ? "rtl" : "ltr",
      className
    )}>
      
      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center p-4">
          {children}
        </main>
        
        {/* Home button */}
        {showHomeButton && (
          <div className={cn(
            "absolute bottom-4 z-20",
            arabic ? "left-4" : "right-4"
          )}>
            <KioskButton
              variant="outline"
              size="kiosk"
              onClick={() => navigate("/kiosk")}
              className="bg-white border-2 border-gray-300 hover:bg-gray-100 text-black"
            >
              <Home className="w-6 h-6 ml-2" />
              {arabic ? "الرئيسية" : "Home"}
            </KioskButton>
          </div>
        )}
      </div>
    </div>
  );
};