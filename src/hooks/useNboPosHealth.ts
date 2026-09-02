import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import NboEcr, { isNboNativeAvailable, type NboStatusResult } from "@/services/nboEcrPlugin";
import { getCachedNboPosConfig } from "@/lib/kioskConfig";
import {
  deriveHealth,
  HEALTH_KEEPALIVE_MS,
  HEALTH_POLL_MS,
  type PosHealthSnapshot,
} from "@/lib/posHealth";

/**
 * Kiosk-side health loop for the OM-A880 (spec §5).
 * Runs only while idle — it is never mounted during a payment session — and
 * reports each change (plus a 60 s keep-alive) to the backend.
 */
export function useNboPosHealth(kioskId: string | null, enabled = true) {
  const [snapshot, setSnapshot] = useState<PosHealthSnapshot>({
    state: "offline",
    transportConnected: false,
    responded: false,
    message: "Checking terminal…",
  });
  const [checking, setChecking] = useState(false);

  const failuresRef = useRef(0);
  const lastReportRef = useRef<{ state: string; at: number }>({ state: "", at: 0 });
  const attachedRef = useRef<boolean | null>(null);

  const report = useCallback(
    async (next: PosHealthSnapshot) => {
      if (!kioskId) return;
      const now = Date.now();
      const changed = lastReportRef.current.state !== next.state;
      if (!changed && now - lastReportRef.current.at < HEALTH_KEEPALIVE_MS) return;
      lastReportRef.current = { state: next.state, at: now };
      try {
        await supabase.functions.invoke("report-pos-health", {
          body: {
            kioskId,
            state: next.state,
            transportConnected: next.transportConnected,
            responded: next.responded,
            printerStatus: next.printerStatus ?? null,
            readerStatus: next.readerStatus ?? null,
            paperOk: next.paperOk ?? null,
            batteryOk: next.batteryOk ?? null,
            errorCode: next.errorCode ?? null,
            message: next.message ?? null,
            terminalLabel: getCachedNboPosConfig(kioskId)?.terminal_label ?? null,
          },
        });
      } catch (err) {
        console.warn("[PosHealth] report failed", err);
      }
    },
    [kioskId],
  );

  const probe = useCallback(async () => {
    setChecking(true);
    try {
      const cfg = (kioskId && getCachedNboPosConfig(kioskId)) || {};
      let attached = attachedRef.current;
      try {
        const availability = await NboEcr.isAvailable();
        attached = availability.deviceAttached === true;
      } catch {
        attached = false;
      }
      attachedRef.current = attached;

      let reply: NboStatusResult | null = null;
      if (attached) {
        try {
          reply = await NboEcr.getStatus({
            baudRate: cfg.baud_rate || 115200,
            vendorId: cfg.vendor_id || 0,
            productId: cfg.product_id || 0,
            timeoutSeconds: 8,
          });
        } catch {
          reply = null;
        }
      }

      if (attached && (!reply || !reply.responded)) failuresRef.current += 1;
      else failuresRef.current = 0;

      const next = deriveHealth(!!attached, reply, failuresRef.current);
      next.checkedAt = new Date().toISOString();
      next.terminalLabel = (cfg as { terminal_label?: string }).terminal_label ?? null;
      setSnapshot(next);
      void report(next);
    } finally {
      setChecking(false);
    }
  }, [kioskId, report]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let removeListener: (() => Promise<void>) | null = null;

    void probe();
    const interval = window.setInterval(() => {
      if (!cancelled) void probe();
    }, HEALTH_POLL_MS);

    if (isNboNativeAvailable()) {
      NboEcr.addListener("posConnection", (event) => {
        attachedRef.current = event.attached;
        failuresRef.current = 0;
        void probe();
      })
        .then((handle) => {
          removeListener = handle.remove;
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void removeListener?.();
    };
  }, [enabled, probe]);

  return { snapshot, checking, refresh: probe };
}
