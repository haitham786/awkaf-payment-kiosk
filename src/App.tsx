import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAudioInitializer } from "./hooks/useAudioInitializer";
import { NetworkStatus } from "./components/shared/NetworkStatus";
import { startBackgroundSync } from "./services/offlineQueueService";

const queryClient = new QueryClient();

// Lazy-load route modules to reduce native startup work and avoid boot-time crashes
// caused by evaluating rarely-used modules on app launch.
const Index = React.lazy(() => import("./pages/Index"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Auth = React.lazy(() => import("./pages/Auth"));
const FirstLoginPage = React.lazy(() => import("./pages/auth/FirstLoginPage"));
const ResetPasswordPage = React.lazy(() => import("./pages/auth/ResetPasswordPage"));

const KioskHomepage = React.lazy(() => import("./pages/kiosk/KioskHomepage"));
const PresetAmountsPage = React.lazy(() => import("./pages/kiosk/PresetAmountsPage"));
const AmountPage = React.lazy(() => import("./pages/kiosk/AmountPage"));
const ConfirmationPage = React.lazy(() => import("./pages/kiosk/ConfirmationPage"));
const KioskSetupPanel = React.lazy(() => import("./pages/kiosk/KioskSetupPanel"));
const PaymentRequestPage = React.lazy(() => import("./pages/kiosk/PaymentRequestPage"));
const PaymentProcessingPage = React.lazy(() => import("./pages/kiosk/PaymentProcessingPage"));
const NFCPaymentPage = React.lazy(() => import("./pages/kiosk/NFCPaymentPage"));
const ThankYouPage = React.lazy(() => import("./pages/kiosk/ThankYouPage"));
const MobileNumberPage = React.lazy(() => import("./pages/kiosk/MobileNumberPage"));
const ErrorPage = React.lazy(() => import("./pages/kiosk/ErrorPage"));
const POSDiagnosticsPage = React.lazy(() => import("./pages/kiosk/POSDiagnosticsPage"));

const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const CategoriesManagement = React.lazy(() => import("./pages/admin/CategoriesManagement"));
const KiosksManagement = React.lazy(() => import("./pages/admin/KiosksManagement"));
const AdminsManagement = React.lazy(() => import("./pages/admin/AdminsManagement"));
const AddAdminPage = React.lazy(() => import("./pages/admin/AddAdminPage"));
const SMSSettings = React.lazy(() => import("./pages/admin/SMSSettings"));
const EnhancedStatistics = React.lazy(() => import("./pages/admin/EnhancedStatistics"));
const ProfilePage = React.lazy(() => import("./pages/admin/ProfilePage"));

const AppContent = () => {
  const { isAudioReady, showInitPrompt } = useAudioInitializer();

  // Use HashRouter on native (file://) to avoid startup route issues like /index.html.
  const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

  // Start background sync for offline transactions
  React.useEffect(() => {
    startBackgroundSync();
  }, []);

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
      <Router>
        <React.Suspense
          fallback={
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
              <p className="text-sm">Loading...</p>
            </div>
          }
        >
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
            <Route path="/kiosk/nfc-payment" element={<NFCPaymentPage />} />
            <Route path="/kiosk/thank-you" element={<ThankYouPage />} />
            <Route path="/kiosk/mobile-number" element={<MobileNumberPage />} />
            <Route path="/kiosk/error" element={<ErrorPage />} />
            <Route path="/kiosk/diagnostics" element={<POSDiagnosticsPage />} />

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
        </React.Suspense>
      </Router>
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
