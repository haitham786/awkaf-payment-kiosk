import { supabase } from "@/integrations/supabase/client";

export type KioskPaymentMode = "soft_pos" | "payment_gateway" | "test_payment" | "hardware_pos";
export type ReceiptChannel = "sms" | "whatsapp" | "both";

export interface KioskRuntimeConfig {
  payment_mode?: KioskPaymentMode;
  soft_pos?: {
    auth_key?: string;
    is_production?: boolean;
    mode?: "test" | "live";
  };
  payment_gateway?: {
    mode?: "test" | "live";
  };
  hardware_pos?: {
    tid?: string;
    mid?: string;
    service_url?: string;
    currency_code?: string;
    environment?: "uat" | "production";
    timeout_seconds?: number;
  };
  sound_enabled?: boolean;
  receipt_channel?: ReceiptChannel;
}

// Simple in-memory cache to prevent redundant Edge Function calls
let cachedConfig: { config: KioskRuntimeConfig; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds
const CONFIG_TIMEOUT_MS = 2500;
const PAYMENT_MODE_LS_KEY = (kioskId: string) => `kiosk:payment_mode:${kioskId}`;

function withConfigTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Kiosk config request timed out")), CONFIG_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Synchronously read the last-known payment mode for a kiosk from localStorage.
 * Used to route the donor to the correct payment screen with ZERO network wait.
 */
export function getCachedPaymentMode(kioskId: string): KioskPaymentMode | null {
  try {
    const v = localStorage.getItem(PAYMENT_MODE_LS_KEY(kioskId));
    if (v === "soft_pos" || v === "payment_gateway" || v === "test_payment") return v;
    return null;
  } catch {
    return null;
  }
}

function persistPaymentMode(kioskId: string, mode: KioskPaymentMode | undefined) {
  try {
    if (mode) localStorage.setItem(PAYMENT_MODE_LS_KEY(kioskId), mode);
  } catch {
    /* ignore */
  }
}

export async function loadKioskRuntimeConfig(
  kioskId: string,
  options: { includeSoftPosSecret?: boolean; forceRefresh?: boolean } = {},
): Promise<KioskRuntimeConfig | null> {
  // Return cached config if available and not expired, unless forcing refresh or requesting secrets
  if (!options.forceRefresh && !options.includeSoftPosSecret && cachedConfig && (Date.now() - cachedConfig.timestamp < CACHE_TTL)) {
    console.log('[KioskConfig] Using cached runtime config');
    return cachedConfig.config;
  }

  try {
    const { data, error } = await withConfigTimeout(
      supabase.functions.invoke("get-kiosk-config", {
        body: {
          kioskId,
          includeSoftPosSecret: options.includeSoftPosSecret === true,
        },
      }),
    );

    if (error) {
      console.error('[KioskConfig] Error invoking get-kiosk-config:', error);
      // If we have an expired cache, return it as fallback on error
      if (cachedConfig) return cachedConfig.config;
      throw error;
    }

    const config = (data?.kiosk?.configuration ?? null) as KioskRuntimeConfig | null;

    // Persist the (non-secret) payment mode so the next donation can route instantly.
    if (config?.payment_mode) persistPaymentMode(kioskId, config.payment_mode);

    // Only cache if we didn't request secrets (to keep cache clean/safe)
    if (config && !options.includeSoftPosSecret) {
      cachedConfig = { config, timestamp: Date.now() };
    }

    return config;
  } catch (err) {
    console.error('[KioskConfig] Failed to load runtime config:', err);
    if (cachedConfig) return cachedConfig.config;
    throw err;
  }
}
