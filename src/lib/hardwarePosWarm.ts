import { supabase } from "@/integrations/supabase/client";
import { getCachedPaymentMode, loadKioskRuntimeConfig } from "@/lib/kioskConfig";

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
// Set when the donor is sitting idle on the home screen. Stale-terminal release
// is only allowed after two uninterrupted minutes there, so a periodic probe
// can never clear a terminal session while a donor is mid-donation.
let idleOnHomeSince = 0;

export function markKioskIdleOnHome() {
  idleOnHomeSince = Date.now();
}

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
    idleOnHomeSince = 0;
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

  // Stale release is gated on genuine idle time at the home screen: a periodic
  // probe that fires while a donor is anywhere else in the flow must never
  // carry release authority — the backend re-checks too, but the kiosk is the
  // first line of defence against cancelling a live payment prompt.
  const idleLongEnough = idleOnHomeSince > 0 && Date.now() - idleOnHomeSince > 120_000;
  void warmHardwarePos(true, idleLongEnough).finally(() => {
    if (keepAliveUsers === 0 || sessionBusy) return;
    const backoff = consecutiveFailures > 0
      ? Math.min(MAX_BACKOFF_MS, READY_INTERVAL_MS * 2 ** Math.min(consecutiveFailures, 4))
      : READY_INTERVAL_MS;
    scheduleNextProbe(backoff);
  });
}

/**
 * Cold-install bootstrap: the readiness loop used to stay silent until a kiosk
 * config fetch had cached the payment mode, so the very first payment after an
 * install paid the full cold-start cost. This fetches the configuration first
 * when the kiosk id is known but nothing is cached yet, so the keep-alive and
 * warm probes work from the first app launch.
 */
export async function ensureHardwarePosReadiness(): Promise<boolean> {
  if (canWarmHardwarePos()) return true;
  try {
    const kioskId = localStorage.getItem("kiosk_id");
    if (!kioskId) return false;
    await loadKioskRuntimeConfig(kioskId);
    return canWarmHardwarePos() !== null;
  } catch {
    return false;
  }
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
