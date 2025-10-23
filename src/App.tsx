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
import PaymentProcessingPage from "./pages/kiosk/PaymentProcessingPage";
import ThankYouPage from "./pages/kiosk/ThankYouPage";
import MobileNumberPage from "./pages/kiosk/MobileNumberPage";
import ErrorPage from "./pages/kiosk/ErrorPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CategoriesManagement from "./pages/admin/CategoriesManagement";
import KiosksManagement from "./pages/admin/KiosksManagement";
import AdminsManagement from "./pages/admin/AdminsManagement";
import AddAdminPage from "./pages/admin/AddAdminPage";
import SMSSettings from "./pages/admin/SMSSettings";
import EnhancedStatistics from "./pages/admin/EnhancedStatistics";
import ProfilePage from "./pages/admin/ProfilePage";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAudioInitializer } from "./hooks/useAudioInitializer";
import { NetworkStatus } from "./components/shared/NetworkStatus";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAudioReady, showInitPrompt } = useAudioInitializer();

  return (
    <>
      {/* Audio initialization overlay - invisible but captures first touch */}
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
            <Route path="/kiosk/payment-processing" element={<PaymentProcessingPage />} />
            <Route path="/kiosk/thank-you" element={<ThankYouPage />} />
            <Route path="/kiosk/mobile-number" element={<MobileNumberPage />} />
            <Route path="/kiosk/error" element={<ErrorPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/categories" element={<CategoriesManagement />} />
            <Route path="/admin/kiosks" element={<KiosksManagement />} />
            <Route path="/admin/admins" element={<AdminsManagement />} />
            <Route path="/admin/add-admin" element={<AddAdminPage />} />
            <Route path="/admin/sms-settings" element={<SMSSettings />} />
            <Route path="/admin/statistics" element={<EnhancedStatistics />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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
