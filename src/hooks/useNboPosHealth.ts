import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import NboEcr, { isNboNativeAvailable, type NboStatusResult, type NboTerminalInfoResult } from "@/services/nboEcrPlugin";
import { getCachedNboPosConfig } from "@/lib/kioskConfig";
import {
  deriveHealth,
  HEALTH_KEEPALIVE_MS,
  HEALTH_POLL_MS,
  type PosHealthSnapshot,
} from "@/lib/posHealth";

const APP_VERSION = "kiosk-web";
const TERMINAL_INFO_REFRESH_MS = 10 * 60 * 1000;

/**
 * Kiosk-side health loop for the OM-A880 (spec §5).
 * Runs only while idle — it is never mounted during a payment session — and
 * reports each change (plus a 60 s keep-alive) to the backend.
 */
export function useNboPosHealth(kioskId: string | null, enabled = true) {
  const [snapshot, setSnapshot] = useState<PosHealthSnapshot>({
    state: "unknown",
    transportConnected: false,
    responded: false,
    message: "Awaiting first heartbeat…",
  });
  const [checking, setChecking] = useState(false);

  const failuresRef = useRef(0);
  const lastReportRef = useRef<{ state: string; at: number }>({ state: "", at: 0 });
  const attachedRef = useRef<boolean | null>(null);
  const connectionInfoRef = useRef<string | null>(null);
  const terminalInfoRef = useRef<{ info: NboTerminalInfoResult | null; at: number }>({ info: null, at: 0 });

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
            tid: next.tid ?? null,
            serialNumber: next.serialNumber ?? null,
            firmwareVersion: next.firmwareVersion ?? null,
            connectionInfo: next.connectionInfo ?? null,
            appVersion: next.appVersion ?? APP_VERSION,
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
        connectionInfoRef.current = availability.connectionInfo ?? connectionInfoRef.current;
      } catch {
        attached = false;
      }
      attachedRef.current = attached;

      const link = {
        baudRate: cfg.baud_rate || 115200,
        vendorId: cfg.vendor_id || 0,
        productId: cfg.product_id || 0,
        timeoutSeconds: 8,
      };

      let reply: NboStatusResult | null = null;
      if (attached) {
        try {
          reply = await NboEcr.getStatus(link);
        } catch {
          reply = null;
        }
      }

      // Terminal identity (GetTerminalInfo 109) — refreshed occasionally, never during a payment.
      if (attached && reply?.responded && Date.now() - terminalInfoRef.current.at > TERMINAL_INFO_REFRESH_MS) {
        try {
          const info = await NboEcr.getTerminalInfo(link);
          if (info?.responded) terminalInfoRef.current = { info, at: Date.now() };
          else terminalInfoRef.current = { info: terminalInfoRef.current.info, at: Date.now() };
        } catch {
          terminalInfoRef.current = { info: terminalInfoRef.current.info, at: Date.now() };
        }
      }

      if (attached && (!reply || !reply.responded)) failuresRef.current += 1;
      else failuresRef.current = 0;

      const next = deriveHealth(!!attached, reply, failuresRef.current);
      const info = terminalInfoRef.current.info;
      next.checkedAt = new Date().toISOString();
      next.terminalLabel = (cfg as { terminal_label?: string }).terminal_label ?? null;
      next.tid = info?.tid ?? null;
      next.serialNumber = info?.serialNumber ?? null;
      next.firmwareVersion = info?.firmwareVersion ?? null;
      next.connectionInfo = connectionInfoRef.current;
      next.appVersion = APP_VERSION;
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

    // Auto-recover: USB re-attach and device wake resume the heartbeat immediately.
    if (isNboNativeAvailable()) {
      NboEcr.addListener("posConnection", (event) => {
        attachedRef.current = event.attached;
        failuresRef.current = 0;
        terminalInfoRef.current = { info: null, at: 0 };
        void probe();
      })
        .then((handle) => {
          removeListener = handle.remove;
        })
        .catch(() => undefined);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) void probe();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void removeListener?.();
    };
  }, [enabled, probe]);

  return { snapshot, checking, refresh: probe };
}
