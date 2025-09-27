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
      "min-h-screen w-full bg-gradient-hero islamic-pattern relative overflow-hidden",
      arabic ? "rtl" : "ltr",
      className
    )}>
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-secondary/20 to-transparent rounded-full -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial from-primary/20 to-transparent rounded-full translate-y-48 -translate-x-48" />
      
      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center p-8">
          {children}
        </main>
        
        {/* Home button - bottom right for Arabic, bottom left for English */}
        {showHomeButton && (
          <div className={cn(
            "absolute bottom-8 z-20",
            arabic ? "left-8" : "right-8"
          )}>
            <KioskButton
              variant="outline"
              size="kiosk"
              onClick={() => navigate("/kiosk")}
              className="bg-card/80 backdrop-blur-sm border-primary/50 hover:bg-primary hover:text-primary-foreground"
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