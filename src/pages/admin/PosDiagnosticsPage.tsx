import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface PosDiagnosticsRow {
  id: string;
  created_at: string;
  kiosk_id: string | null;
  transaction_id: string | null;
  correlation_id: string | null;
  amount_baisas: number | null;
  invoice_number: string | null;
  dispatched: boolean | null;
  dispatch_attempts: number | null;
  outcome: string | null;
  failure_type: string | null;
  http_status: number | null;
  web_response_status: string | null;
  web_response_error: string | null;
  pos_resp_status: string | null;
  pos_resp_code: string | null;
  session_state_before: string | null;
  seconds_since_previous_attempt: number | null;
  request_to_dispatch_ms: number | null;
  afs_round_trip_ms: number | null;
}

type DispatchedFilter = "all" | "dispatched" | "not_dispatched";

const PosDiagnosticsPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PosDiagnosticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchedFilter, setDispatchedFilter] = useState<DispatchedFilter>("all");
  const [failureTypeFilter, setFailureTypeFilter] = useState("all");
  const [failureTypes, setFailureTypes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pos_diagnostics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (dispatchedFilter === "dispatched") query = query.eq("dispatched", true);
      if (dispatchedFilter === "not_dispatched") query = query.eq("dispatched", false);
      if (failureTypeFilter !== "all") query = query.eq("failure_type", failureTypeFilter);

      const { data, error } = await query;
      if (error) throw error;
      const nextRows = (data || []) as PosDiagnosticsRow[];
      setRows(nextRows);
      setFailureTypes((current) => {
        const merged = new Set(current);
        nextRows.forEach((row) => {
          if (row.failure_type) merged.add(row.failure_type);
        });
        return Array.from(merged).sort();
      });
    } catch (error) {
      console.error("Failed to load POS diagnostics:", error);
    } finally {
      setLoading(false);
    }
  }, [dispatchedFilter, failureTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatAmount = (baisas: number | null) => {
    if (baisas === null) return "—";
    return `${Math.floor(baisas / 1000)}.${String(baisas % 1000).padStart(3, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">POS Dispatch Diagnostics</h1>
              <p className="text-xs text-muted-foreground">
                One row per payment attempt — latest 200. Use this to see whether failures happen before dispatch, at the AFS gateway, or at the terminal.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        <Card className="p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Dispatched to AFS</label>
            <select
              className="border rounded-md px-2 py-1.5 text-sm bg-background"
              value={dispatchedFilter}
              onChange={(event) => setDispatchedFilter(event.target.value as DispatchedFilter)}
            >
              <option value="all">All</option>
              <option value="dispatched">Dispatched</option>
              <option value="not_dispatched">Not dispatched</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Failure type</label>
            <select
              className="border rounded-md px-2 py-1.5 text-sm bg-background"
              value={failureTypeFilter}
              onChange={(event) => setFailureTypeFilter(event.target.value)}
            >
              <option value="all">All</option>
              {failureTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground ml-auto">
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </p>
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-2 font-medium">Time</th>
                <th className="p-2 font-medium">Amount</th>
                <th className="p-2 font-medium">Invoice</th>
                <th className="p-2 font-medium">Dispatched</th>
                <th className="p-2 font-medium">Attempts</th>
                <th className="p-2 font-medium">Outcome</th>
                <th className="p-2 font-medium">Failure type</th>
                <th className="p-2 font-medium">HTTP</th>
                <th className="p-2 font-medium">AFS status</th>
                <th className="p-2 font-medium">POS code</th>
                <th className="p-2 font-medium">Session before</th>
                <th className="p-2 font-medium">Prev gap (s)</th>
                <th className="p-2 font-medium">Dispatch (ms)</th>
                <th className="p-2 font-medium">AFS round trip (ms)</th>
                <th className="p-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={15} className="p-6 text-center text-muted-foreground">
                    No diagnostics recorded yet. Rows appear after the next payment attempt.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">{format(new Date(row.created_at), "dd MMM HH:mm:ss")}</td>
                  <td className="p-2">{formatAmount(row.amount_baisas)}</td>
                  <td className="p-2 font-mono">{row.invoice_number || "—"}</td>
                  <td className="p-2">
                    {row.dispatched === null ? "—" : row.dispatched
                      ? <span className="text-emerald-600 font-medium">yes</span>
                      : <span className="text-red-600 font-medium">no</span>}
                  </td>
                  <td className="p-2">{row.dispatch_attempts ?? "—"}</td>
                  <td className="p-2">{row.outcome || "—"}</td>
                  <td className="p-2 font-mono">{row.failure_type || "—"}</td>
                  <td className="p-2">{row.http_status ?? "—"}</td>
                  <td className="p-2 font-mono">{row.web_response_status || "—"}</td>
                  <td className="p-2 font-mono">{row.pos_resp_code || row.pos_resp_status || "—"}</td>
                  <td className="p-2">{row.session_state_before || "—"}</td>
                  <td className="p-2">{row.seconds_since_previous_attempt ?? "—"}</td>
                  <td className="p-2">{row.request_to_dispatch_ms ?? "—"}</td>
                  <td className="p-2">{row.afs_round_trip_ms ?? "—"}</td>
                  <td className="p-2 max-w-[240px] truncate" title={row.web_response_error || ""}>
                    {row.web_response_error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

export default PosDiagnosticsPage;
