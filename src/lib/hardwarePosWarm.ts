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
const WARM_THROTTLE_MS = 20_000;

export function warmHardwarePos(): void {
  try {
    const kioskId = localStorage.getItem("kiosk_id");
    if (!kioskId) return;
    if (getCachedPaymentMode(kioskId) !== "hardware_pos") return;

    const now = Date.now();
    if (now - lastWarmAt < WARM_THROTTLE_MS) return;
    lastWarmAt = now;

    void supabase.functions
      .invoke("apex-ecr-payment", { body: { action: "warm", kioskId } })
      .catch(() => {
        /* warming is best-effort */
      });
  } catch {
    /* ignore */
  }
}
