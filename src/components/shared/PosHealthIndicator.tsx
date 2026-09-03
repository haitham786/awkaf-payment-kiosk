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

/** Traffic-light card for one OM-A880 terminal — icon + word + colour, never colour alone. */
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
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.chipClass}`}>
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    );
  }

  const paperLabel = paperOk === false ? "Empty / low" : paperOk === true ? "OK" : "—";
  const batteryLabel = batteryOk === false ? "Low" : batteryOk === true ? "OK" : "—";

  return (
    <div className={`rounded-lg border p-3 ${meta.chipClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              OM-A880 Terminal — {meta.label}
              <span className="ms-2 text-[11px] font-normal opacity-80">{meta.labelAr}</span>
            </p>
            {message && <p className="text-xs opacity-90">{message}</p>}
            {errorCode && <p className="text-[11px] opacity-80">Last code: {errorCode}</p>}
          </div>
        </div>
        <div className="text-end">
          <span className="text-[10px] opacity-80">
            {live && <span className="me-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />}
            updated {lastSeenLabel(updatedAt)}
          </span>
          <p className="text-[10px] opacity-70">{omanTimestamp(updatedAt)}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-90">
        <span>Paper: {paperLabel}</span>
        <span>Battery: {batteryLabel}</span>
        {readerLabel(readerStatus) && <span>Reader: {readerLabel(readerStatus)}</span>}
        {meta.blocksDonations && <span className="font-semibold">Cannot take payments</span>}
      </div>

      {(terminalLabel || tid || serialNumber || firmwareVersion || connectionInfo || appVersion) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-current/10 pt-2 text-[10px] opacity-80">
          {terminalLabel && <span>Terminal: {terminalLabel}</span>}
          {tid && <span>TID: {tid}</span>}
          {serialNumber && <span>S/N: {serialNumber}</span>}
          {firmwareVersion && <span>Firmware: {firmwareVersion}</span>}
          {connectionInfo && <span>USB: {connectionInfo}</span>}
          {appVersion && <span>App: {appVersion}</span>}
        </div>
      )}

      {(lastTransactionAt || lastTransactionResult) && (
        <div className="mt-1 text-[10px] opacity-80">
          Last transaction: {lastTransactionResult ?? "—"}
          {lastTransactionAt ? ` · ${lastSeenLabel(lastTransactionAt)} (${omanTimestamp(lastTransactionAt)})` : ""}
        </div>
      )}
    </div>
  );
};

export default PosHealthIndicator;
