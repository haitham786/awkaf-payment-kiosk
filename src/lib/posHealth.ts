/**
 * OM-A880 POS health & status model (NBO ECR Direct Integration v1.22).
 *
 * Three layers — transport (USB), heartbeat (GetStatus 114) and condition
 * (paper / battery / reader) — collapse into one of five traffic-light states
 * (four live states plus "unknown" while awaiting the first heartbeat).
 * Nothing here touches the payment path.
 */

export type PosHealthState = "ready" | "attention" | "not_responding" | "offline" | "unknown";

export interface PosHealthSnapshot {
  state: PosHealthState;
  transportConnected: boolean;
  responded: boolean;
  printerStatus?: string | null;
  readerStatus?: string | null;
  paperOk?: boolean | null;
  batteryOk?: boolean | null;
  errorCode?: string | null;
  message?: string | null;
  terminalLabel?: string | null;
  tid?: string | null;
  serialNumber?: string | null;
  firmwareVersion?: string | null;
  appVersion?: string | null;
  connectionInfo?: string | null;
  checkedAt?: string;
}

/** Spec §3 condition codes. */
export const ERR_NO_PAPER = "E006";
export const ERR_LOW_BATTERY = "E011";

/** Server-side offline rule (spec §7): older than 3 minutes = offline. */
export const STALE_AFTER_MS = 3 * 60 * 1000;

/** Silent heartbeat cadence — USB transport only, no serial traffic, no beeps. */
export const HEALTH_POLL_MS = 20_000;
export const HEALTH_KEEPALIVE_MS = 60_000;
/** Deep status (GetStatus 114) is rare — it makes the terminal beep. */
export const DEEP_STATUS_INTERVAL_MS = 20 * 60 * 1000;

/**
 * Transaction lock — while a purchase is in flight nothing else may touch the
 * serial line (not even the silent heartbeat's USB probe).
 */
let transactionActive = false;
export function setPosTransactionActive(active: boolean) {
  transactionActive = active;
}
export function isPosTransactionActive(): boolean {
  return transactionActive;
}

/**
 * Opportunistic condition learned from real transaction responses
 * (E006 = no paper, E011 = low battery), so a dedicated poll is rarely needed.
 */
export interface PosCondition {
  paperOk: boolean | null;
  batteryOk: boolean | null;
  errorCode: string | null;
  at: number;
}
let lastCondition: PosCondition | null = null;
export function recordTransactionCondition(errorCode: string | null | undefined, approved?: boolean) {
  const code = errorCode ? errorCode.toUpperCase().trim() : null;
  if (code === ERR_NO_PAPER) {
    lastCondition = { paperOk: false, batteryOk: lastCondition?.batteryOk ?? null, errorCode: code, at: Date.now() };
  } else if (code === ERR_LOW_BATTERY) {
    lastCondition = { paperOk: lastCondition?.paperOk ?? null, batteryOk: false, errorCode: code, at: Date.now() };
  } else if (approved) {
    // A clean approved sale printed a receipt: paper and power are fine.
    lastCondition = { paperOk: true, batteryOk: true, errorCode: null, at: Date.now() };
  }
}
export function getTransactionCondition(): PosCondition | null {
  return lastCondition;
}


/** Housekeeping codes are NEVER payment declines (missing-features doc §4). */
export const HOUSEKEEPING_CODES = new Set([ERR_NO_PAPER, ERR_LOW_BATTERY]);

export function isHousekeepingCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return HOUSEKEEPING_CODES.has(code.toUpperCase().trim());
}

/** Plain-language text for a condition code (shown to the attendant). */
export function conditionText(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code.toUpperCase().trim()) {
    case ERR_NO_PAPER:
      return "Out of paper — load a new receipt roll";
    case ERR_LOW_BATTERY:
      return "Low battery — connect the terminal to power";
    default:
      return null;
  }
}

export interface PosHealthMeta {
  label: string;
  /** Lucide icon name rendered next to the word (never colour alone). */
  icon: "check" | "alert" | "help" | "plug" | "clock";
  dotColor: string;
  pillText: string;
  pillBg: string;
  borderColor: string;
  softBg: string;
  blocksDonations: boolean;
}

/** English-only state tokens. Colours are accent-only (pill / dot / 4px border). */
export const POS_HEALTH_META: Record<PosHealthState, PosHealthMeta> = {
  ready: {
    label: "Ready",
    icon: "check",
    dotColor: "#159A66",
    pillText: "#0E7A50",
    pillBg: "#E9F7EF",
    borderColor: "#159A66",
    softBg: "#E9F7EF",
    blocksDonations: false,
  },
  attention: {
    label: "Needs attention",
    icon: "alert",
    dotColor: "#C98A00",
    pillText: "#8A6300",
    pillBg: "#FDF3DA",
    borderColor: "#C98A00",
    softBg: "#FDF3DA",
    blocksDonations: false,
  },
  not_responding: {
    label: "Not responding",
    icon: "help",
    dotColor: "#E0483D",
    pillText: "#B3271C",
    pillBg: "#FDECEA",
    borderColor: "#E0483D",
    softBg: "#FDECEA",
    blocksDonations: true,
  },
  offline: {
    label: "Offline",
    icon: "plug",
    dotColor: "#E0483D",
    pillText: "#B3271C",
    pillBg: "#FDECEA",
    borderColor: "#E0483D",
    softBg: "#FDECEA",
    blocksDonations: true,
  },
  unknown: {
    label: "Awaiting first heartbeat",
    icon: "clock",
    dotColor: "#64748B",
    pillText: "#475569",
    pillBg: "#F1F5F9",
    borderColor: "#94A3B8",
    softBg: "#F1F5F9",
    blocksDonations: false,
  },
};

export interface RawStatusReply {
  responded: boolean;
  printerStatus?: string | null;
  readerStatus?: string | null;
  errorCode?: string | null;
  lastTransactionErrorCode?: string | null;
}

function flagged(value: string | null | undefined, ...needles: string[]): boolean {
  if (!value) return false;
  const v = value.toUpperCase();
  return needles.some((n) => v.includes(n));
}

/** Map transport + heartbeat + condition into the single state (spec §2 / §5.3). */
export function deriveHealth(
  transportConnected: boolean,
  reply: RawStatusReply | null,
  consecutiveFailures: number,
): PosHealthSnapshot {
  if (!transportConnected) {
    return {
      state: "offline",
      transportConnected: false,
      responded: false,
      message: "USB disconnected — reseat the cable / power the terminal on",
    };
  }

  if (!reply || !reply.responded) {
    // Debounce: require two consecutive failures before flipping (spec §5).
    if (consecutiveFailures < 2) {
      return {
        state: "ready",
        transportConnected: true,
        responded: false,
        message: "Awaiting terminal reply…",
      };
    }
    return {
      state: "not_responding",
      transportConnected: true,
      responded: false,
      message: "USB connected but the terminal is silent — power-cycle it and check Interface Mode",
    };
  }

  const codes = [reply.errorCode, reply.lastTransactionErrorCode].filter(Boolean) as string[];
  const noPaper =
    codes.includes(ERR_NO_PAPER) || flagged(reply.printerStatus, "NO PAPER", "PAPER OUT", "OUT OF PAPER");
  const paperLow = flagged(reply.printerStatus, "PAPER LOW", "LOW PAPER");
  const lowBattery = codes.includes(ERR_LOW_BATTERY) || flagged(reply.readerStatus, "LOW BATTERY");
  const printerFault = flagged(reply.printerStatus, "FAULT", "ERROR");
  const readerFault = flagged(reply.readerStatus, "FAULT", "ERROR");

  if (noPaper || paperLow || lowBattery || printerFault || readerFault) {
    const notes: string[] = [];
    if (noPaper) notes.push(conditionText(ERR_NO_PAPER)!);
    if (paperLow && !noPaper) notes.push("Paper low — replace the roll soon");
    if (lowBattery) notes.push(conditionText(ERR_LOW_BATTERY)!);
    if (printerFault && !noPaper) notes.push("Printer fault");
    if (readerFault) notes.push("Card reader fault");
    return {
      state: "attention",
      transportConnected: true,
      responded: true,
      printerStatus: reply.printerStatus ?? null,
      readerStatus: reply.readerStatus ?? null,
      paperOk: !noPaper && !paperLow,
      batteryOk: !lowBattery,
      errorCode: codes[0] ?? null,
      message: notes.join(" · "),
    };
  }

  return {
    state: "ready",
    transportConnected: true,
    responded: true,
    printerStatus: reply.printerStatus ?? null,
    readerStatus: reply.readerStatus ?? null,
    paperOk: true,
    batteryOk: true,
    message: "Terminal healthy",
  };
}

/** Apply the server-side staleness rule to a stored row. */
export function effectiveState(
  state: string | null | undefined,
  updatedAt: string | null | undefined,
  /** Per-kiosk offline threshold in ms (falls back to the 3-minute spec rule). */
  staleAfterMs: number = STALE_AFTER_MS,
): PosHealthState {
  if (!state && !updatedAt) return "unknown";
  const known = (state ?? "offline") as PosHealthState;
  if (!updatedAt) return "unknown";
  if (Date.now() - new Date(updatedAt).getTime() > staleAfterMs) return "offline";
  return POS_HEALTH_META[known] ? known : "offline";
}

export function lastSeenLabel(updatedAt: string | null | undefined): string {
  if (!updatedAt) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Absolute Oman (GST, UTC+4) timestamp used everywhere alongside relative time. */
export function omanTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Muscat",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${text} GST`;
}

export interface HistoryRow {
  state: string;
  created_at: string;
}

export interface UptimeSummary {
  /** Percentage of the window where the terminal was usable (ready/attention). */
  percent: number;
  outages: number;
  lastOutageAt: string | null;
  lastOutageMinutes: number | null;
}

const DOWN_STATES = new Set(["offline", "not_responding"]);

/**
 * Uptime over a window, computed from the append-only history log.
 * Each history row is treated as the state from its timestamp until the next one.
 */
export function computeUptime(rows: HistoryRow[], windowMs: number, now = Date.now()): UptimeSummary {
  const start = now - windowMs;
  const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (ordered.length === 0) return { percent: 0, outages: 0, lastOutageAt: null, lastOutageMinutes: null };

  let downMs = 0;
  let outages = 0;
  let lastOutageAt: string | null = null;
  let lastOutageMinutes: number | null = null;
  let covered = 0;

  for (let i = 0; i < ordered.length; i++) {
    const from = new Date(ordered[i].created_at).getTime();
    const to = i + 1 < ordered.length ? new Date(ordered[i + 1].created_at).getTime() : now;
    const clampedFrom = Math.max(from, start);
    const clampedTo = Math.min(to, now);
    if (clampedTo <= clampedFrom) continue;
    const span = clampedTo - clampedFrom;
    covered += span;
    if (DOWN_STATES.has(ordered[i].state)) {
      downMs += span;
      outages += 1;
      lastOutageAt = ordered[i].created_at;
      lastOutageMinutes = Math.max(1, Math.round(span / 60000));
    }
  }

  if (covered <= 0) return { percent: 0, outages: 0, lastOutageAt: null, lastOutageMinutes: null };
  const percent = Math.max(0, Math.min(100, ((covered - downMs) / covered) * 100));
  return { percent, outages, lastOutageAt, lastOutageMinutes };
}

/** Plain-language card-reader wording (never a bare numeric code). */
export function readerLabel(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["0", "00", "OK", "IDLE", "READY"].includes(upper)) return "idle";
  if (["1", "01", "CARD", "CARD PRESENT", "BUSY"].includes(upper)) return "card present";
  if (upper.includes("FAULT") || upper.includes("ERROR")) return "fault — needs service";
  if (upper.includes("REMOV")) return "waiting for card removal";
  return raw.toLowerCase();
}
