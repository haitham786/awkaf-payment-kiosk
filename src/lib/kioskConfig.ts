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

export async function loadKioskRuntimeConfig(
  kioskId: string,
  options: { includeSoftPosSecret?: boolean } = {},
): Promise<KioskRuntimeConfig | null> {
  const { data, error } = await supabase.functions.invoke("get-kiosk-config", {
    body: {
      kioskId,
      includeSoftPosSecret: options.includeSoftPosSecret === true,
    },
  });

  if (error) throw error;
  return (data?.kiosk?.configuration ?? null) as KioskRuntimeConfig | null;
}