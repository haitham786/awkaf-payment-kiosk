import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import KioskHomepage from "./pages/kiosk/KioskHomepage";
import AmountPage from "./pages/kiosk/AmountPage";
import ConfirmationPage from "./pages/kiosk/ConfirmationPage";
import PaymentRequestPage from "./pages/kiosk/PaymentRequestPage";
import PaymentProcessingPage from "./pages/kiosk/PaymentProcessingPage";
import ThankYouPage from "./pages/kiosk/ThankYouPage";
import MobileNumberPage from "./pages/kiosk/MobileNumberPage";
import ErrorPage from "./pages/kiosk/ErrorPage";
import AdminDashboard from "./pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Kiosk Routes */}
          <Route path="/kiosk" element={<KioskHomepage />} />
          <Route path="/kiosk/amount" element={<AmountPage />} />
          <Route path="/kiosk/confirmation" element={<ConfirmationPage />} />
          <Route path="/kiosk/payment-request" element={<PaymentRequestPage />} />
          <Route path="/kiosk/payment-processing" element={<PaymentProcessingPage />} />
          <Route path="/kiosk/thank-you" element={<ThankYouPage />} />
          <Route path="/kiosk/mobile-number" element={<MobileNumberPage />} />
          <Route path="/kiosk/error" element={<ErrorPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
