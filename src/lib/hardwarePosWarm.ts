import { supabase } from "@/integrations/supabase/client";
import { getCachedPaymentMode } from "@/lib/kioskConfig";

/**
 * Keeps the hardware POS path permanently ready.
 *
 * Apex/AFS is a request/response web service, so no socket can be held open to
 * the terminal. The practical equivalent is an idle readiness loop: while the
 * donor is on the home, category or amount screens, a low-frequency probe keeps
 * the edge isolate hot, the terminal configuration cached and the TLS route to
 * the AFS host open, so the SALE that follows is dispatched with no cold-start.
 *
 * The probe never touches transaction state and is fully suspended while a
 * payment session is running, so it can never compete with a real SALE.
 */

export type TerminalReadiness = "unknown" | "ready" | "reconnecting" | "busy";

interface ReadinessSnapshot {
  status: TerminalReadiness;
  checkedAt: number;
}

const READY_INTERVAL_MS = 45_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const WARM_THROTTLE_MS = 8_000;

let lastWarmAt = 0;
let warmInFlight: Promise<boolean> | null = null;
let keepAliveUsers = 0;
let consecutiveFailures = 0;
let sessionBusy = false;
let loopTimer: number | null = null;

let snapshot: ReadinessSnapshot = { status: "unknown", checkedAt: 0 };
const listeners = new Set<(snapshot: ReadinessSnapshot) => void>();

function publish(status: TerminalReadiness) {
  snapshot = { status, checkedAt: Date.now() };
  listeners.forEach((listener) => listener(snapshot));
}

export function getTerminalReadiness(): ReadinessSnapshot {
  return snapshot;
}

export function subscribeTerminalReadiness(listener: (snapshot: ReadinessSnapshot) => void): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

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
 * Suspends the readiness loop for the whole duration of a payment session so a
 * probe can never sit in front of, or race with, the donor's SALE.
 */
export function setHardwarePosSessionBusy(busy: boolean) {
  sessionBusy = busy;
  if (busy) {
    publish("busy");
    if (loopTimer !== null) {
      window.clearTimeout(loopTimer);
      loopTimer = null;
    }
    return;
  }
  consecutiveFailures = 0;
  if (keepAliveUsers > 0) scheduleNextProbe(1_000);
}

/**
 * One readiness probe. `releaseStale` lets the backend clear an orphaned
 * terminal prompt whose lease has already expired — only ever sent from an idle
 * screen, never while a donor is paying.
 */
export function warmHardwarePos(force = false, releaseStale = false): Promise<boolean> {
  const context = canWarmHardwarePos();
  if (!context) return Promise.resolve(false);
  if (sessionBusy) return Promise.resolve(false);
  if (warmInFlight) return warmInFlight;

  const now = Date.now();
  if (!force && now - lastWarmAt < WARM_THROTTLE_MS) return Promise.resolve(true);

  warmInFlight = supabase.functions
    .invoke("apex-ecr-payment", {
      body: { action: "warm", kioskId: context.kioskId, releaseStale },
    })
    .then(({ data, error }) => {
      const reachable = !error && data?.success === true && data?.hostReachable === true;
      if (!reachable) {
        consecutiveFailures += 1;
        publish("reconnecting");
        return false;
      }
      lastWarmAt = Date.now();
      consecutiveFailures = 0;
      publish(data?.busy === true ? "busy" : "ready");
      return true;
    })
    .catch(() => {
      consecutiveFailures += 1;
      publish("reconnecting");
      return false;
    })
    .finally(() => {
      warmInFlight = null;
    });

  return warmInFlight;
}

function scheduleNextProbe(delayMs: number) {
  if (loopTimer !== null) window.clearTimeout(loopTimer);
  loopTimer = window.setTimeout(runProbe, delayMs);
}

function usable() {
  return document.visibilityState === "visible" && navigator.onLine;
}

function runProbe() {
  loopTimer = null;
  if (keepAliveUsers === 0 || sessionBusy) return;
  if (!usable()) {
    scheduleNextProbe(READY_INTERVAL_MS);
    return;
  }

  void warmHardwarePos(true, true).finally(() => {
    if (keepAliveUsers === 0 || sessionBusy) return;
    const backoff = consecutiveFailures > 0
      ? Math.min(MAX_BACKOFF_MS, READY_INTERVAL_MS * 2 ** Math.min(consecutiveFailures, 4))
      : READY_INTERVAL_MS;
    scheduleNextProbe(backoff);
  });
}

/**
 * Starts the idle readiness loop and recovers immediately on focus, resume or
 * network return, so the terminal path is never left cold after the device
 * sleeps or the connection drops.
 */
export function startHardwarePosKeepAlive(): () => void {
  keepAliveUsers += 1;

  const recover = () => {
    if (sessionBusy || !usable()) return;
    consecutiveFailures = 0;
    scheduleNextProbe(0);
  };
  const handleVisibility = () => {
    if (document.visibilityState === "visible") recover();
  };

  if (keepAliveUsers === 1) {
    scheduleNextProbe(0);
    window.addEventListener("focus", recover);
    window.addEventListener("pageshow", recover);
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", handleVisibility);
  }

  return () => {
    keepAliveUsers = Math.max(0, keepAliveUsers - 1);
    if (keepAliveUsers > 0) return;
    if (loopTimer !== null) {
      window.clearTimeout(loopTimer);
      loopTimer = null;
    }
    window.removeEventListener("focus", recover);
    window.removeEventListener("pageshow", recover);
    window.removeEventListener("online", recover);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
