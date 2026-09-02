import { POS_HEALTH_META, lastSeenLabel, type PosHealthState } from "@/lib/posHealth";

interface PosHealthIndicatorProps {
  state: PosHealthState;
  message?: string | null;
  paperOk?: boolean | null;
  batteryOk?: boolean | null;
  terminalLabel?: string | null;
  updatedAt?: string | null;
  compact?: boolean;
}

/** Traffic-light chip for one OM-A880 terminal (Ready / Needs attention / Not responding / Offline). */
export const PosHealthIndicator = ({
  state,
  message,
  paperOk,
  batteryOk,
  terminalLabel,
  updatedAt,
  compact = false,
}: PosHealthIndicatorProps) => {
  const meta = POS_HEALTH_META[state] ?? POS_HEALTH_META.offline;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.chipClass}`}>
        <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
        {meta.label}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${meta.chipClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
          <div>
            <p className="text-sm font-semibold">OM-A880 Terminal — {meta.label}</p>
            {message && <p className="text-xs opacity-90">{message}</p>}
          </div>
        </div>
        <span className="text-[10px] opacity-80">{updatedAt ? lastSeenLabel(updatedAt) : ""}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] opacity-90">
        <span>Paper: {paperOk === false ? "Out of paper" : paperOk === true ? "OK" : "—"}</span>
        <span>Battery: {batteryOk === false ? "Low" : batteryOk === true ? "OK" : "—"}</span>
        {terminalLabel && <span>Terminal: {terminalLabel}</span>}
        {meta.blocksDonations && <span className="font-semibold">Cannot take payments</span>}
      </div>
    </div>
  );
};

export default PosHealthIndicator;
