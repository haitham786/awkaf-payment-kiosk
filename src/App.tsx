import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import FirstLoginPage from "./pages/auth/FirstLoginPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import KioskHomepage from "./pages/kiosk/KioskHomepage";
import PresetAmountsPage from "./pages/kiosk/PresetAmountsPage";
import AmountPage from "./pages/kiosk/AmountPage";
import ConfirmationPage from "./pages/kiosk/ConfirmationPage";
import KioskSetupPanel from "./pages/kiosk/KioskSetupPanel";
import PaymentRequestPage from "./pages/kiosk/PaymentRequestPage";
import HardwarePosPaymentPage from "./pages/kiosk/HardwarePosPaymentPage";
import NboPosPaymentPage from "./pages/kiosk/NboPosPaymentPage";
import TestPaymentPage from "./pages/kiosk/TestPaymentPage";
import ThankYouPage from "./pages/kiosk/ThankYouPage";
import MobileNumberPage from "./pages/kiosk/MobileNumberPage";
import ErrorPage from "./pages/kiosk/ErrorPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CategoriesManagement from "./pages/admin/CategoriesManagement";
import KiosksManagement from "./pages/admin/KiosksManagement";
import AdminsManagement from "./pages/admin/AdminsManagement";
import AddAdminPage from "./pages/admin/AddAdminPage";
import SMSSettings from "./pages/admin/SMSSettings";
import WhatsAppSettings from "./pages/admin/WhatsAppSettings";
import EnhancedStatistics from "./pages/admin/EnhancedStatistics";
import ProfilePage from "./pages/admin/ProfilePage";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAudioInitializer } from "./hooks/useAudioInitializer";
import { NetworkStatus } from "./components/shared/NetworkStatus";
import { startBackgroundSync } from "./services/offlineQueueService";
import { PosHealthDaemon } from "./components/kiosk/PosHealthDaemon";

const queryClient = new QueryClient();

const AdminPanelLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="admin-panel">{children}</div>;
};

const AppContent = () => {
  const { showInitPrompt } = useAudioInitializer();
  
  React.useEffect(() => {
    startBackgroundSync();
  }, []);

  return (
    <>
      {showInitPrompt && (
        <div className="fixed inset-0 z-50 bg-black/5 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg pointer-events-auto">
            <p className="text-gray-800 text-sm">اضغط في أي مكان للبدء</p>
          </div>
        </div>
      )}
      
      <Toaster />
      <Sonner />
      <NetworkStatus />
      <BrowserRouter>
          <PosHealthDaemon />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/first-login" element={<FirstLoginPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            
            {/* Kiosk Routes */}
            <Route path="/kiosk" element={<KioskHomepage />} />
            <Route path="/kiosk/setup" element={<KioskSetupPanel />} />
            <Route path="/kiosk/preset-amounts" element={<PresetAmountsPage />} />
            <Route path="/kiosk/amount" element={<AmountPage />} />
            <Route path="/kiosk/confirmation" element={<ConfirmationPage />} />
            <Route path="/kiosk/payment-request" element={<PaymentRequestPage />} />
            <Route path="/kiosk/hardware-pos" element={<HardwarePosPaymentPage />} />
            <Route path="/kiosk/nbo-pos" element={<NboPosPaymentPage />} />
            <Route path="/kiosk/test-payment" element={<TestPaymentPage />} />
            <Route path="/kiosk/thank-you" element={<ThankYouPage />} />
            <Route path="/kiosk/mobile-number" element={<MobileNumberPage />} />
            <Route path="/kiosk/error" element={<ErrorPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPanelLayout><AdminDashboard /></AdminPanelLayout>} />
            <Route path="/admin/categories" element={<AdminPanelLayout><CategoriesManagement /></AdminPanelLayout>} />
            <Route path="/admin/kiosks" element={<AdminPanelLayout><KiosksManagement /></AdminPanelLayout>} />
            <Route path="/admin/admins" element={<AdminPanelLayout><AdminsManagement /></AdminPanelLayout>} />
            <Route path="/admin/add-admin" element={<AdminPanelLayout><AddAdminPage /></AdminPanelLayout>} />
            <Route path="/admin/sms-settings" element={<AdminPanelLayout><SMSSettings /></AdminPanelLayout>} />
            <Route path="/admin/whatsapp-settings" element={<AdminPanelLayout><WhatsAppSettings /></AdminPanelLayout>} />
            <Route path="/admin/statistics" element={<AdminPanelLayout><EnhancedStatistics /></AdminPanelLayout>} />
            <Route path="/admin/profile" element={<AdminPanelLayout><ProfilePage /></AdminPanelLayout>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
