import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import PosHealthIndicator from "@/components/shared/PosHealthIndicator";
import { computeUptime, effectiveState, lastSeenLabel, omanTimestamp, type HistoryRow, POS_HEALTH_META } from "@/lib/posHealth";
import { History } from "lucide-react";
import PosAlertSettingsCard from "@/components/admin/PosAlertSettingsCard";

interface Props {
  kioskId: string;
  kioskName?: string;
  fallbackTerminalLabel?: string | null;
  status: any | null;
}

interface TxSummary {
  approved: number;
  declined: number;
  amount: number;
  lastAt: string | null;
  lastResult: string | null;
}

/** Per-kiosk health block: state, identity, uptime, last transaction and history. */
export const PosKioskHealthPanel = ({ kioskId, kioskName, fallbackTerminalLabel, status }: Props) => {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [tx, setTx] = useState<TxSummary | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [offlineAfterMs, setOfflineAfterMs] = useState(3 * 60 * 1000);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("kiosk_pos_status_history")
        .select("state, message, created_at")
        .eq("kiosk_id", kioskId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(data || []);
      setHistory((data || []).map((r: any) => ({ state: r.state, created_at: r.created_at })));

      const dayStart = new Date();
      dayStart.setUTCHours(dayStart.getUTCHours() + 4);
      dayStart.setUTCHours(0, 0, 0, 0);
      const { data: txRows } = await supabase
        .from("transactions")
        .select("status, amount_baisas, created_at")
        .eq("kiosk_id", kioskId)
        .gte("created_at", dayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      const list = txRows || [];
      const approvedRows = list.filter((t: any) => ["completed", "success", "approved"].includes(String(t.status)));
      setTx({
        approved: approvedRows.length,
        declined: list.length - approvedRows.length,
        amount: approvedRows.reduce((sum: number, t: any) => sum + (Number(t.amount_baisas) || 0), 0) / 1000,
        lastAt: list[0]?.created_at ?? null,
        lastResult: list[0]
          ? ["completed", "success", "approved"].includes(String(list[0].status))
            ? "Approved"
            : "Declined"
          : null,
      });
    };
    void load();
  }, [kioskId, status?.updated_at]);

  useEffect(() => {
    const loadThreshold = async () => {
      const { data } = await supabase
        .from("pos_alert_settings")
        .select("offline_threshold_seconds")
        .eq("kiosk_id", kioskId)
        .maybeSingle();
      if (data?.offline_threshold_seconds) setOfflineAfterMs(Number(data.offline_threshold_seconds) * 1000);
    };
    void loadThreshold();
  }, [kioskId]);

  const state = effectiveState(status?.state, status?.updated_at, offlineAfterMs);
  const uptimeDay = computeUptime(history, 24 * 3600 * 1000);
  const uptimeWeek = computeUptime(history, 7 * 24 * 3600 * 1000);

  return (
    <div className="mt-3 max-w-md space-y-2">
      <PosHealthIndicator
        state={state}
        message={
          status
            ? state === "offline"
              ? `No heartbeat for over ${Math.round(offlineAfterMs / 60000)} minute(s) — USB disconnected or kiosk app not running`
              : status.message
            : "No health beat received from this kiosk yet"
        }
        paperOk={status?.paper_ok}
        batteryOk={status?.battery_ok}
        readerStatus={status?.reader_status}
        errorCode={status?.error_code}
        terminalLabel={status?.terminal_label || fallbackTerminalLabel}
        tid={status?.tid}
        serialNumber={status?.serial_number}
        firmwareVersion={status?.firmware_version}
        appVersion={status?.app_version}
        connectionInfo={status?.connection_info}
        lastTransactionAt={tx?.lastAt}
        lastTransactionResult={tx?.lastResult}
        updatedAt={status?.updated_at}
        live
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Uptime today: {history.length ? `${uptimeDay.percent.toFixed(1)}%` : "—"}</span>
        <span>7-day: {history.length ? `${uptimeWeek.percent.toFixed(1)}%` : "—"}</span>
        <span>
          Last outage:{" "}
          {uptimeWeek.lastOutageAt
            ? `${lastSeenLabel(uptimeWeek.lastOutageAt)} (${uptimeWeek.lastOutageMinutes}m)`
            : "none in 7 days"}
        </span>
      </div>

      {tx && (
        <div className="text-[11px] text-muted-foreground">
          Today: {tx.approved} approved · {tx.declined} declined · OMR {tx.amount.toFixed(3)} collected
        </div>
      )}

      <PosAlertSettingsCard kioskId={kioskId} kioskName={kioskName} />

      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setShowHistory((v) => !v)}>
        <History className="mr-1 h-3 w-3" />
        {showHistory ? "Hide status history" : "Status history"}
      </Button>

      {showHistory && (
        <div className="max-h-48 overflow-y-auto rounded-md border p-2 text-[11px]">
          {rows.length === 0 ? (
            <p className="text-muted-foreground">No status changes recorded yet.</p>
          ) : (
            rows.map((r: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-2 border-b py-1 last:border-0">
                <span className="font-medium">{POS_HEALTH_META[r.state as keyof typeof POS_HEALTH_META]?.label ?? r.state}</span>
                <span className="text-right text-muted-foreground">
                  {omanTimestamp(r.created_at)} · {lastSeenLabel(r.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PosKioskHealthPanel;
