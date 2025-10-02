import { useNavigate } from "react-router-dom";
import { KioskButton } from "@/components/ui/kiosk-button";
import { Card } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-hero islamic-pattern flex items-center justify-center p-8">
      <Card className="p-12 bg-card/90 backdrop-blur-sm shadow-elegant border border-primary/20 text-center max-w-2xl">
        <div className="space-y-8">
          <div className="w-24 h-24 mx-auto bg-gradient-primary rounded-full shadow-elegant flex items-center justify-center">
            <span className="text-4xl text-primary-foreground">🕌</span>
          </div>
          
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Islamic Donation Kiosk System
            </h1>
            <p className="text-xl text-muted-foreground">
              Complete donation management solution for mosques and Islamic organizations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KioskButton
              variant="default"
              size="xl"
              onClick={() => navigate('/kiosk')}
              className="p-8 flex flex-col items-center space-y-2"
            >
              <span className="text-3xl mb-2">📱</span>
              <span className="text-lg font-semibold">Kiosk Interface</span>
              <span className="text-sm opacity-80">Arabic donation screens</span>
            </KioskButton>
            
            <KioskButton
              variant="secondary"
              size="xl"
              onClick={() => navigate('/auth')}
              className="p-8 flex flex-col items-center space-y-2"
            >
              <span className="text-3xl mb-2">⚙️</span>
              <span className="text-lg font-semibold">Admin Dashboard</span>
              <span className="text-sm opacity-80">Management & Analytics</span>
            </KioskButton>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Index;
