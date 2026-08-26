import { supabase } from "@/integrations/supabase/client";
import { getCachedPaymentMode } from "@/lib/kioskConfig";

/**
 * Pre-warms the hardware POS path while the donor is still choosing a category
 * or typing an amount. This boots the edge function isolate, loads the terminal
 * configuration into its cache and opens the TLS connection to the AFS host, so
 * the SALE that follows is dispatched with no cold-start or lookup delay.
 *
 * Fire-and-forget: any failure is silent and never affects the donation flow.
 */
let lastWarmAt = 0;
let warmInFlight: Promise<boolean> | null = null;
let keepAliveTimer: number | null = null;
let keepAliveUsers = 0;
const WARM_THROTTLE_MS = 12_000;
const KEEP_ALIVE_INTERVAL_MS = 15_000;

function canWarmHardwarePos(): { kioskId: string } | null {
  try {
    const kioskId = localStorage.getItem("kiosk_id");
    if (!kioskId || getCachedPaymentMode(kioskId) !== "hardware_pos") return null;
    return { kioskId };
  } catch {
    return null;
  }
}

/**
 * Keeps both the browser-to-backend route and the backend-to-AFS route warm.
 * Failed warm-ups are never throttled, allowing the next lifecycle/network
 * event to recover immediately.
 */
export function warmHardwarePos(force = false): Promise<boolean> {
  const context = canWarmHardwarePos();
  if (!context) return Promise.resolve(false);

  if (warmInFlight) return warmInFlight;

  const now = Date.now();
  if (!force && now - lastWarmAt < WARM_THROTTLE_MS) return Promise.resolve(true);

  warmInFlight = supabase.functions
    .invoke("apex-ecr-payment", { body: { action: "warm", kioskId: context.kioskId } })
    .then(({ data, error }) => {
      const warmed = !error && data?.success === true && data?.hostReachable === true;
      if (warmed) lastWarmAt = Date.now();
      return warmed;
    })
    .catch(() => false)
    .finally(() => {
      warmInFlight = null;
    });

  return warmInFlight;
}

/**
 * Starts one shared heartbeat for the lifetime of the kiosk app. Browsers and
 * Android WebViews pause timers in the background, so resume/online events also
 * trigger a forced warm-up before the next donor can confirm a payment.
 */
export function startHardwarePosKeepAlive(): () => void {
  keepAliveUsers += 1;

  const warmWhenUsable = (force = false) => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      void warmHardwarePos(force);
    }
  };

  const handleResume = () => warmWhenUsable(true);
  const handleVisibility = () => {
    if (document.visibilityState === "visible") warmWhenUsable(true);
  };

  if (keepAliveTimer === null) {
    warmWhenUsable(true);
    keepAliveTimer = window.setInterval(() => warmWhenUsable(), KEEP_ALIVE_INTERVAL_MS);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    window.addEventListener("online", handleResume);
    document.addEventListener("visibilitychange", handleVisibility);
  }

  return () => {
    keepAliveUsers = Math.max(0, keepAliveUsers - 1);
    if (keepAliveUsers > 0 || keepAliveTimer === null) return;

    window.clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    window.removeEventListener("focus", handleResume);
    window.removeEventListener("pageshow", handleResume);
    window.removeEventListener("online", handleResume);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
