import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KioskLayout } from "@/components/kiosk/KioskLayout";
import { loadKioskRuntimeConfig, getCachedPaymentMode, type KioskPaymentMode } from "@/lib/kioskConfig";
import { Loader2 } from "lucide-react";

const routeFor = (mode: KioskPaymentMode | null | undefined, category: string, amount: number): string => {
  if (mode === 'test_payment') return `/kiosk/test-payment?category=${category}&amount=${amount}`;
  if (mode === 'payment_gateway') return `/kiosk/thawani-gateway?category=${category}&amount=${amount}`;
  if (mode === 'hardware_pos') return `/kiosk/hardware-pos?category=${category}&amount=${amount}`;
  if (mode === 'nbo_pos') return `/kiosk/nbo-pos?category=${category}&amount=${amount}`;
  // Default to Soft POS (Thawani Lamsa) — the primary payment path.
  return `/kiosk/nfc-payment?category=${category}&amount=${amount}`;
};

const PaymentRequestPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'donation';
  const amount = parseFloat(searchParams.get('amount') || '0');

  useEffect(() => {
    const kioskId = localStorage.getItem('kiosk_id');

    // INSTANT ROUTING: use the last-known payment mode from localStorage so the
    // donor lands on the Thawani Lamsa screen immediately — no waiting for the
    // edge-function round-trip. We refresh the cache in the background.
    const cachedMode = kioskId ? getCachedPaymentMode(kioskId) : null;
    navigate(routeFor(cachedMode, category, amount), { replace: true });

    if (kioskId) {
      // Background refresh — keeps the cached payment_mode fresh for next time.
      loadKioskRuntimeConfig(kioskId).catch((err) => {
        console.warn('[PaymentRequestPage] Background config refresh failed:', err);
      });
    }
  }, [navigate, category, amount]);

  return (
    <KioskLayout showHomeButton={false}>
      <div className="flex flex-col items-center justify-center gap-3 text-gray-900">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        <div className="text-center leading-tight">
          <p className="text-lg font-bold">جاري فتح الدفع</p>
          <p className="text-sm text-gray-600">Opening payment</p>
        </div>
      </div>
    </KioskLayout>
  );
};

export default PaymentRequestPage;
