import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import NboEcr, { isNboNativeAvailable, type NboStatusResult, type NboTerminalInfoResult } from "@/services/nboEcrPlugin";
import { getCachedNboPosConfig } from "@/lib/kioskConfig";
import {
  deriveHealth,
  DEEP_STATUS_INTERVAL_MS,
  getTransactionCondition,
  HEALTH_KEEPALIVE_MS,
  HEALTH_POLL_MS,
  isPosTransactionActive,
  type PosHealthSnapshot,
  type RawStatusReply,
} from "@/lib/posHealth";

const APP_VERSION = "kiosk-web";
const TERMINAL_INFO_REFRESH_MS = 60 * 60 * 1000;

/**
 * Kiosk-side health loop for the OM-A880.
 *
 * The frequent heartbeat is SILENT: it only reads the USB transport state
 * (device attached / port open) and re-reports the last-known condition. No
 * frame is written to the serial line, so the terminal never beeps.
 *
 * GetStatus (114) — which does beep — runs only on a deliberate deep check:
 * when the device first attaches, on the manual "Ping / Test now" button, and
 * on a long (20 min) interval. Paper/battery are also learned opportunistically
 * from real transaction responses. Nothing is ever sent mid-transaction.
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
  /** Last real GetStatus reply — reused by the silent heartbeats. */
  const lastReplyRef = useRef<RawStatusReply | null>(null);
  const lastDeepAtRef = useRef(0);

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

  /**
   * @param deep when true a GetStatus (114) frame is sent (terminal beeps).
   *             Heartbeats always pass false.
   */
  const probe = useCallback(
    async (deep = false) => {
      // Rule 4: never touch the terminal while a purchase is in flight.
      if (isPosTransactionActive()) return;
      setChecking(true);
      try {
        const cfg = (kioskId && getCachedNboPosConfig(kioskId)) || {};
        const wasAttached = attachedRef.current;
        let attached = wasAttached;
        try {
          const availability = await NboEcr.isAvailable();
          attached = availability.deviceAttached === true;
          connectionInfoRef.current = availability.connectionInfo ?? connectionInfoRef.current;
        } catch {
          attached = false;
        }
        attachedRef.current = attached;

        if (!attached) {
          // Transport gone: forget the cached reply so the next attach re-reads it.
          lastReplyRef.current = null;
          terminalInfoRef.current = { info: null, at: 0 };
          lastDeepAtRef.current = 0;
          failuresRef.current = 0;
        }

        const link = {
          baudRate: cfg.baud_rate || 115200,
          vendorId: cfg.vendor_id || 0,
          productId: cfg.product_id || 0,
          timeoutSeconds: 8,
        };

        // A deep check runs on explicit request, on a fresh attach, or when the
        // long interval has elapsed — never on a plain heartbeat.
        const freshAttach = attached === true && wasAttached !== true;
        const intervalDue = attached === true && Date.now() - lastDeepAtRef.current > DEEP_STATUS_INTERVAL_MS;
        const runDeep = attached === true && (deep || freshAttach || intervalDue);

        let reply: RawStatusReply | null = lastReplyRef.current;
        if (runDeep) {
          lastDeepAtRef.current = Date.now();
          let live: NboStatusResult | null = null;
          try {
            live = await NboEcr.getStatus(link);
          } catch {
            live = null;
          }
          if (live?.responded) {
            lastReplyRef.current = live;
            reply = live;
            failuresRef.current = 0;
          } else {
            failuresRef.current += 1;
            reply = null;
          }

          // Terminal identity (109) — only alongside a successful deep check.
          if (live?.responded && Date.now() - terminalInfoRef.current.at > TERMINAL_INFO_REFRESH_MS) {
            try {
              const info = await NboEcr.getTerminalInfo(link);
              terminalInfoRef.current = { info: info?.responded ? info : terminalInfoRef.current.info, at: Date.now() };
            } catch {
              terminalInfoRef.current = { info: terminalInfoRef.current.info, at: Date.now() };
            }
          }
        }

        // Fold in paper/battery learned from real transaction responses.
        const condition = getTransactionCondition();
        if (reply && condition) {
          reply = {
            ...reply,
            errorCode: condition.errorCode ?? reply.errorCode ?? null,
            lastTransactionErrorCode: condition.errorCode ?? reply.lastTransactionErrorCode ?? null,
          };
        } else if (!reply && condition && attached) {
          reply = {
            responded: true,
            errorCode: condition.errorCode,
            lastTransactionErrorCode: condition.errorCode,
          };
        }

        const next = deriveHealth(!!attached, reply, failuresRef.current);
        if (attached && !runDeep && reply) {
          // Silent heartbeat: liveness comes from USB, not from a serial reply.
          next.responded = false;
          if (next.state === "ready") next.message = "USB connected — terminal reachable";
        }
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
    },
    [kioskId, report],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let removeListener: (() => Promise<void>) | null = null;

    void probe(false);
    const interval = window.setInterval(() => {
      if (!cancelled) void probe(false);
    }, HEALTH_POLL_MS);

    // Auto-recover: USB re-attach triggers one deliberate deep read.
    if (isNboNativeAvailable()) {
      NboEcr.addListener("posConnection", (event) => {
        attachedRef.current = event.attached;
        failuresRef.current = 0;
        lastReplyRef.current = null;
        terminalInfoRef.current = { info: null, at: 0 };
        lastDeepAtRef.current = 0;
        void probe(event.attached === true);
      })
        .then((handle) => {
          removeListener = handle.remove;
        })
        .catch(() => undefined);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) void probe(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void removeListener?.();
    };
  }, [enabled, probe]);

  return { snapshot, checking, refresh: () => probe(true) };
}
