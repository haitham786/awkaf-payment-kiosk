/**
 * OM-A880 POS health & status model (NBO ECR Direct Integration v1.22).
 *
 * Three layers — transport (USB), heartbeat (GetStatus 114) and condition
 * (paper / battery / reader) — collapse into one of four traffic-light states.
 * Nothing here touches the payment path.
 */

export type PosHealthState = "ready" | "attention" | "not_responding" | "offline";

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
  checkedAt?: string;
}

/** Spec §3 condition codes. */
export const ERR_NO_PAPER = "E006";
export const ERR_LOW_BATTERY = "E011";

/** Server-side offline rule (spec §7): older than 3 minutes = offline. */
export const STALE_AFTER_MS = 3 * 60 * 1000;

export const HEALTH_POLL_MS = 20_000;
export const HEALTH_KEEPALIVE_MS = 60_000;

export interface PosHealthMeta {
  label: string;
  labelAr: string;
  dotClass: string;
  chipClass: string;
  blocksDonations: boolean;
}

export const POS_HEALTH_META: Record<PosHealthState, PosHealthMeta> = {
  ready: {
    label: "Ready",
    labelAr: "جاهز",
    dotClass: "bg-emerald-500",
    chipClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blocksDonations: false,
  },
  attention: {
    label: "Needs attention",
    labelAr: "يحتاج إلى متابعة",
    dotClass: "bg-amber-500",
    chipClass: "bg-amber-50 text-amber-700 border-amber-200",
    blocksDonations: false,
  },
  not_responding: {
    label: "Not responding",
    labelAr: "لا يستجيب",
    dotClass: "bg-orange-500",
    chipClass: "bg-orange-50 text-orange-700 border-orange-200",
    blocksDonations: true,
  },
  offline: {
    label: "Offline",
    labelAr: "غير متصل",
    dotClass: "bg-red-500",
    chipClass: "bg-red-50 text-red-700 border-red-200",
    blocksDonations: true,
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
      message: "Terminal disconnected — check USB cable / power",
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
      message: "Terminal connected but not answering — check it is on and in Interface Mode",
    };
  }

  const codes = [reply.errorCode, reply.lastTransactionErrorCode].filter(Boolean) as string[];
  const noPaper =
    codes.includes(ERR_NO_PAPER) || flagged(reply.printerStatus, "NO PAPER", "PAPER OUT", "OUT OF PAPER");
  const lowBattery = codes.includes(ERR_LOW_BATTERY) || flagged(reply.readerStatus, "LOW BATTERY");
  const printerFault = flagged(reply.printerStatus, "FAULT", "ERROR");
  const readerFault = flagged(reply.readerStatus, "FAULT", "ERROR");

  if (noPaper || lowBattery || printerFault || readerFault) {
    const notes: string[] = [];
    if (noPaper) notes.push(`Printer out of paper (${ERR_NO_PAPER})`);
    if (lowBattery) notes.push(`Battery low (${ERR_LOW_BATTERY})`);
    if (printerFault && !noPaper) notes.push("Printer fault");
    if (readerFault) notes.push("Card reader fault");
    return {
      state: "attention",
      transportConnected: true,
      responded: true,
      printerStatus: reply.printerStatus ?? null,
      readerStatus: reply.readerStatus ?? null,
      paperOk: !noPaper,
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
    message: "Paper OK · Battery OK",
  };
}

/** Apply the server-side staleness rule to a stored row. */
export function effectiveState(state: string | null | undefined, updatedAt: string | null | undefined): PosHealthState {
  const known = (state ?? "offline") as PosHealthState;
  if (!updatedAt) return "offline";
  if (Date.now() - new Date(updatedAt).getTime() > STALE_AFTER_MS) return "offline";
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
