import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Unplug } from "lucide-react";
import { POS_HEALTH_META, lastSeenLabel, omanTimestamp, readerLabel, type PosHealthState } from "@/lib/posHealth";

interface PosHealthIndicatorProps {
  state: PosHealthState;
  message?: string | null;
  paperOk?: boolean | null;
  batteryOk?: boolean | null;
  readerStatus?: string | null;
  errorCode?: string | null;
  terminalLabel?: string | null;
  tid?: string | null;
  serialNumber?: string | null;
  firmwareVersion?: string | null;
  appVersion?: string | null;
  connectionInfo?: string | null;
  lastTransactionAt?: string | null;
  lastTransactionResult?: string | null;
  updatedAt?: string | null;
  live?: boolean;
  compact?: boolean;
}

const ICONS = {
  check: CheckCircle2,
  alert: AlertTriangle,
  help: HelpCircle,
  plug: Unplug,
  clock: Clock,
};

/** Per-kiosk OM-A880 health block: light card with a 4px state-coloured accent border, status pill, and neutral metric chips. */
export const PosHealthIndicator = ({
  state,
  message,
  paperOk,
  batteryOk,
  readerStatus,
  errorCode,
  terminalLabel,
  tid,
  serialNumber,
  firmwareVersion,
  appVersion,
  connectionInfo,
  lastTransactionAt,
  lastTransactionResult,
  updatedAt,
  live = false,
  compact = false,
}: PosHealthIndicatorProps) => {
  const meta = POS_HEALTH_META[state] ?? POS_HEALTH_META.unknown;
  const Icon = ICONS[meta.icon];

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: meta.pillBg, color: meta.pillText, borderColor: meta.borderColor }}
      >
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    );
  }

  const paperLabel = paperOk === false ? "Empty / low" : paperOk === true ? "OK" : "Unknown";
  const batteryLabel = batteryOk === false ? "Low" : batteryOk === true ? "OK" : "Unknown";
  const reader = readerLabel(readerStatus) ?? "idle";

  const chipColor = (ok: boolean | null | undefined) => {
    if (ok === true) return { bg: "#E7F6EF", text: "#0F7A52", border: "#16A34A" };
    if (ok === false) return { bg: "#FEF4DA", text: "#8A6300", border: "#E8A400" };
    return { bg: "#F1F5F9", text: "#64748B", border: "#CBD5E1" };
  };
  const readerColor = (value: string) => {
    if (value === "idle") return { bg: "#F1F5F9", text: "#64748B", border: "#CBD5E1" };
    if (value.includes("fault") || value.includes("needs service")) return { bg: "#FDECEC", text: "#B42318", border: "#DC3545" };
    return { bg: "#E7F6EF", text: "#0F7A52", border: "#16A34A" };
  };

  const paperStyle = chipColor(paperOk);
  const batteryStyle = chipColor(batteryOk);
  const readerStyle = readerColor(reader);

  return (
    <div
      className="rounded-2xl border border-kiosk-border bg-kiosk-surface p-3.5"
      style={{ borderLeftWidth: 4, borderLeftColor: meta.borderColor }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: meta.softBg, color: meta.dotColor }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-kiosk-text">
                Terminal {meta.label}
              </span>
            </div>
          </div>
        </div>
        <div className="min-w-[112px] shrink-0 text-right text-kiosk-muted">
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[11px] font-semibold">
            {live && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: meta.dotColor }} />}
            <span>{lastSeenLabel(updatedAt)}</span>
          </div>
          <p className="whitespace-nowrap text-[9px]">
            {omanTimestamp(updatedAt)}
          </p>
        </div>
      </div>

      {/* Explanation line */}
      {message && (
        <p className="mt-1.5 max-w-[270px] text-[11px] font-normal leading-4 text-kiosk-muted">
          {message}
        </p>
      )}

      {/* Metric chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ backgroundColor: paperStyle.bg, color: paperStyle.text, border: `1px solid ${paperStyle.border}` }}
        >
          <span className="mr-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: paperStyle.text }} /> Paper {paperLabel}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ backgroundColor: batteryStyle.bg, color: batteryStyle.text, border: `1px solid ${batteryStyle.border}` }}
        >
          <span className="mr-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: batteryStyle.text }} /> Battery {batteryLabel}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ backgroundColor: readerStyle.bg, color: readerStyle.text, border: `1px solid ${readerStyle.border}` }}
        >
          <span className="mr-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: readerStyle.text }} /> Reader {reader}
        </span>
      </div>

      {/* Cannot take payments pill */}
      {meta.blocksDonations && (
        <div className="mt-2">
          <span
            className="inline-flex items-center rounded-full bg-kiosk-offline-text px-2.5 py-1 text-[10px] font-semibold text-primary-foreground"
          >
            Cannot take payments
          </span>
        </div>
      )}

    </div>
  );
};

export default PosHealthIndicator;
