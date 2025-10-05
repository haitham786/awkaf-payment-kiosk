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
      "min-h-screen w-full bg-background islamic-pattern relative overflow-hidden",
      arabic ? "rtl" : "ltr",
      className
    )}>
      {/* Futuristic glowing orbs */}
      <div className="absolute inset-0 bg-gradient-hero opacity-50" />
      <div className="absolute top-10 right-20 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-20 left-20 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      
      {/* Scanlines effect */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ 
             backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(180 100% 50%) 2px, hsl(180 100% 50%) 4px)' 
           }} 
      />
      
      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center p-8">
          {children}
        </main>
        
        {/* Futuristic home button */}
        {showHomeButton && (
          <div className={cn(
            "absolute bottom-8 z-20",
            arabic ? "left-8" : "right-8"
          )}>
            <KioskButton
              variant="outline"
              size="kiosk"
              onClick={() => navigate("/kiosk")}
              className="bg-card/40 backdrop-blur-xl border-2 border-primary/70 hover:bg-primary/20 hover:border-primary hover:shadow-neon transition-all duration-300"
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