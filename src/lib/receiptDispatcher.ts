import { supabase } from "@/integrations/supabase/client";
import { loadKioskRuntimeConfig, ReceiptChannel } from "@/lib/kioskConfig";

export interface DispatchPayload {
  mobile_number: string; // 968XXXXXXXX
  category: string;
  reference_number: string;
  transaction_id?: string;
  amount_baisas: number;
}

export interface DispatchResult {
  ok: boolean;
  channel: ReceiptChannel;
  sms?: { success: boolean; error?: string };
  whatsapp?: { success: boolean; error?: string };
}

/**
 * Reads receipt_channel from the locally-stored kiosk configuration. We fetch
 * the kiosk row fresh to honor admin changes immediately, and fall back to
 * "sms" if anything is unavailable.
 */
async function resolveChannel(): Promise<ReceiptChannel> {
  try {
    const kioskId = localStorage.getItem("kiosk_id");
    if (!kioskId) return "sms";
    const cfg = await loadKioskRuntimeConfig(kioskId);
    const value = cfg?.receipt_channel;
    if (value === "sms" || value === "whatsapp" || value === "both") return value;
    return "sms";
  } catch {
    return "sms";
  }
}

export async function sendDonationReceipt(payload: DispatchPayload): Promise<DispatchResult> {
  const channel = await resolveChannel();

  const calls: Array<Promise<{ key: "sms" | "whatsapp"; success: boolean; error?: string }>> = [];

  if (channel === "sms" || channel === "both") {
    calls.push(
      supabase.functions
        .invoke("send-sms", { body: payload })
        .then(({ data, error }) => ({
          key: "sms" as const,
          success: !error && !!data?.success,
          error: error?.message || data?.error,
        }))
        .catch((e) => ({ key: "sms" as const, success: false, error: e?.message || "SMS failed" }))
    );
  }

  if (channel === "whatsapp" || channel === "both") {
    calls.push(
      supabase.functions
        .invoke("send-whatsapp", { body: payload })
        .then(({ data, error }) => ({
          key: "whatsapp" as const,
          success: !error && !!data?.success,
          error: error?.message || data?.error,
        }))
        .catch((e) => ({ key: "whatsapp" as const, success: false, error: e?.message || "WhatsApp failed" }))
    );
  }

  const results = await Promise.all(calls);
  const out: DispatchResult = { ok: false, channel };
  for (const r of results) {
    if (r.key === "sms") out.sms = { success: r.success, error: r.error };
    if (r.key === "whatsapp") out.whatsapp = { success: r.success, error: r.error };
  }
  out.ok = results.some((r) => r.success);
  return out;
}
