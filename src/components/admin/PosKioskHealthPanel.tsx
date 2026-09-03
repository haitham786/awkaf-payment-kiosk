import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import PosHealthIndicator from "@/components/shared/PosHealthIndicator";
import { computeUptime, effectiveState, lastSeenLabel, omanTimestamp, type HistoryRow, POS_HEALTH_META } from "@/lib/posHealth";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import PosAlertSettingsCard from "@/components/admin/PosAlertSettingsCard";
import { CurrencyLogo } from "@/components/kiosk/CurrencyLogo";

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
    <div className="mt-4 space-y-3">
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

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-kiosk-border bg-kiosk-page/50 p-3">
          <p className="text-[9px] font-semibold uppercase text-kiosk-muted">Uptime today</p>
          <p className={`mt-1 text-xl font-extrabold ${history.length && uptimeDay.percent < 90 ? "text-kiosk-attention-text" : "text-kiosk-text"}`}>
            {history.length ? `${uptimeDay.percent.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-kiosk-border bg-kiosk-page/50 p-3">
          <p className="text-[9px] font-semibold uppercase text-kiosk-muted">Uptime · 7 days</p>
          <p className={`mt-1 text-xl font-extrabold ${history.length && uptimeWeek.percent < 90 ? "text-kiosk-attention-text" : "text-kiosk-text"}`}>
            {history.length ? `${uptimeWeek.percent.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-kiosk-border bg-kiosk-page/50 p-3">
          <p className="text-[9px] font-semibold uppercase text-kiosk-muted">Last outage</p>
          <p className="mt-1 text-base font-extrabold text-kiosk-text">{uptimeWeek.lastOutageAt ? lastSeenLabel(uptimeWeek.lastOutageAt) : "None"}</p>
          <p className="text-[10px] text-kiosk-muted">{uptimeWeek.lastOutageAt ? `lasted ${uptimeWeek.lastOutageMinutes}m` : "in 7 days"}</p>
        </div>
        <div className="rounded-xl border border-kiosk-border bg-kiosk-page/50 p-3">
          <p className="text-[9px] font-semibold uppercase text-kiosk-muted">Declined today</p>
          <p className={`mt-1 text-xl font-extrabold ${tx?.declined ? "text-kiosk-offline-text" : "text-kiosk-text"}`}>{tx?.declined ?? "—"}</p>
          <p className="text-[10px] text-kiosk-muted">{tx?.approved ?? 0} approved</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-kiosk-brand/10 bg-kiosk-brand-soft px-3 py-2.5 text-xs font-semibold text-kiosk-brand">
        <span>Collected today</span>
        <span className="flex items-center gap-1.5 text-sm font-extrabold"><CurrencyLogo className="h-4 w-4 object-contain" />{(tx?.amount ?? 0).toFixed(3)}</span>
      </div>

      <div className="border-t border-kiosk-border pt-3">
        <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-normal text-kiosk-muted">Terminal details</h4>
        <div className="grid grid-cols-2 text-[10px]">
          {[
            ["TID", status?.tid || "—"], ["Serial", status?.serial_number || "—"],
            ["Firmware", status?.firmware_version || "—"], ["App", status?.app_version || "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 border-b border-kiosk-border py-2 odd:pr-3 even:pl-3">
              <span className="text-kiosk-muted">{label}</span><span className="truncate font-semibold text-kiosk-text">{value}</span>
            </div>
          ))}
          <div className="col-span-2 flex justify-between gap-3 border-b border-kiosk-border py-2">
            <span className="text-kiosk-muted">USB</span><span className="break-all text-right font-semibold text-kiosk-text">{status?.connection_info || "—"}</span>
          </div>
          <div className="col-span-2 flex justify-between gap-3 border-b border-kiosk-border py-2">
            <span className="shrink-0 text-kiosk-muted">Last transaction</span>
            <span className="text-right font-semibold text-kiosk-text">{tx?.lastResult || "—"}{tx?.lastAt ? ` · ${lastSeenLabel(tx.lastAt)} · ${omanTimestamp(tx.lastAt)}` : ""}</span>
          </div>
        </div>
      </div>

      <PosAlertSettingsCard kioskId={kioskId} kioskName={kioskName} />

      <Button variant="ghost" size="sm" className="h-10 w-full justify-start rounded-xl border border-kiosk-border px-3 text-xs text-kiosk-text hover:bg-kiosk-page" onClick={() => setShowHistory((v) => !v)}>
        <History className="mr-2 h-4 w-4 text-kiosk-muted" />
        Status history
        {showHistory ? <ChevronDown className="ml-auto h-3.5 w-3.5 text-kiosk-muted" /> : <ChevronRight className="ml-auto h-3.5 w-3.5 text-kiosk-muted" />}
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
