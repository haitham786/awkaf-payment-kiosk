import { supabase } from "@/integrations/supabase/client";
import { setHardwarePosSessionBusy } from "@/lib/hardwarePosWarm";

interface HardwarePosSaleRequest {
  kioskId: string;
  transactionId: string;
  amount: number;
  category: string;
}

type SaleInvocation = ReturnType<typeof supabase.functions.invoke>;

const pendingSales = new Map<string, SaleInvocation>();

/**
 * Starts the SALE at the donor's confirmation tap. The payment route consumes
 * the same promise, so React navigation and screen mounting never sit in front
 * of the terminal command. The transaction id makes the handoff idempotent.
 */
export function beginHardwarePosSale(request: HardwarePosSaleRequest): SaleInvocation {
  const existing = pendingSales.get(request.transactionId);
  if (existing) return existing;

  // Claim the terminal for this donor *before* the request leaves the device.
  // The readiness probe is suspended from this exact moment, so an idle probe
  // can never overlap — or cancel — a SALE that is already in flight.
  setHardwarePosSessionBusy(true);

  const invocation = supabase.functions.invoke("apex-ecr-payment", {
    body: { action: "sale", ...request },
  });
  pendingSales.set(request.transactionId, invocation);

  const release = () => {
    window.setTimeout(() => pendingSales.delete(request.transactionId), 30_000);
  };
  void invocation.then(release, release);

  return invocation;
}
