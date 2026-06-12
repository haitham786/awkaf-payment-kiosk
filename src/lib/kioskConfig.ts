import { supabase } from "@/integrations/supabase/client";

export type KioskPaymentMode = "soft_pos" | "payment_gateway" | "test_payment";
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
  sound_enabled?: boolean;
  receipt_channel?: ReceiptChannel;
}

// Simple in-memory cache to prevent redundant Edge Function calls
let cachedConfig: { config: KioskRuntimeConfig; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

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
    const { data, error } = await supabase.functions.invoke("get-kiosk-config", {
      body: {
        kioskId,
        includeSoftPosSecret: options.includeSoftPosSecret === true,
      },
    });

    if (error) {
      console.error('[KioskConfig] Error invoking get-kiosk-config:', error);
      // If we have an expired cache, return it as fallback on error
      if (cachedConfig) return cachedConfig.config;
      throw error;
    }

    const config = (data?.kiosk?.configuration ?? null) as KioskRuntimeConfig | null;
    
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
