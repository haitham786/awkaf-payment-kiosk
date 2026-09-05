import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  MonitorSmartphone,
  RefreshCcw,
  TrendingUp,
  Wallet,
  WifiOff,
} from "lucide-react";

/** Homepage command centre — a monitor, not a second analytics page.
 *  Every figure comes from report_homepage_overview (Asia/Muscat, net of
 *  refunds, excluding test payments). */

const GREEN = "#1F9D55";
const AMBER = "#C98A00";
const RED = "#DC3545";
const CAUSE_COLORS = ["#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4"];

const omr = (baisas: number) =>
  (Number(baisas || 0) / 1000).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

const pctDelta = (current: number, previous: number): number | null => {
  if (!previous) return current ? 100 : null;
  return ((current - previous) / previous) * 100;
};

interface Overview {
  kpi: {
    net_baisas: number;
    attempts: number;
    completed: number;
    failed: number;
    cancelled: number;
    success_rate: number | null;
    active_kiosks: number;
    registered_kiosks: number;
  };
  momentum: Record<"today" | "week" | "month", { net_baisas: number; previous_baisas: number }>;
  target: null | {
    id: string;
    name: string;
    scope: string;
    amount_baisas: number;
    raised_baisas: number;
    days_left: number;
  };
  trend: { day: string; net_baisas: number }[];
  trend_total_baisas: number;
  causes: { name: string; code: string | null; net_baisas: number; prev_net_baisas: number }[];
  causes_total_baisas: number;
  attention: {
    offline_kiosks: { id: string; name: string; state: string; last_seen: string | null }[];
    attention_kiosks: number;
    terminal_conditions: { id: string; name: string; paper_ok: boolean | null; battery_ok: boolean | null }[];
    stuck_count: number;
    receipts_failed_today: number;
    unreconciled_today: number;
    last_hour: { completed: number; failed: number };
  };
}

const Delta = ({ current, previous, suffix }: { current: number; previous: number; suffix: string }) => {
  const delta = pctDelta(current, previous);
  if (delta === null) return <p className="text-xs text-muted-foreground">no {suffix} data</p>;
  const up = delta >= 0;
  return (
    <p className="text-xs font-medium" style={{ color: up ? GREEN : RED }}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs {suffix}
    </p>
  );
};

const KpiCard = ({
  label,
  value,
  unit,
  sublabel,
  icon,
  accent,
  flag,
}: {
  label: string;
  value: string;
  unit?: string;
  sublabel: string;
  icon: React.ReactNode;
  accent?: string;
  flag?: string;
}) => (
  <div
    className="rounded-xl border bg-background p-4 shadow-sm"
    style={accent ? { borderColor: accent } : undefined}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className="mt-1 font-mono text-2xl font-bold tabular-nums"
          style={accent ? { color: accent } : undefined}
        >
          {value}
          {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
        </p>
      </div>
      <span className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</span>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{sublabel}</p>
    {flag && (
      <span
        className="mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
        style={{ color: accent, backgroundColor: `${accent}1a` }}
      >
        {flag}
      </span>
    )}
  </div>
);

const MomentumTile = ({
  label,
  value,
  previous,
  suffix,
}: {
  label: string;
  value: number;
  previous: number;
  suffix: string;
}) => (
  <div className="rounded-xl border bg-background p-4 shadow-sm">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 font-mono text-xl font-bold tabular-nums">
      {omr(value)} <span className="text-xs font-medium text-muted-foreground">OMR</span>
    </p>
    <div className="mt-1">
      <Delta current={value} previous={previous} suffix={suffix} />
    </div>
  </div>
);

interface Props {
  transactions: any[];
  isSuperAdmin: boolean;
}

const HomeCommandCentre = ({ transactions }: Props) => {
  const navigate = useNavigate();
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const [data, setData] = useState<Overview | null>(null);

  const load = useCallback(async () => {
    const { data: result, error } = await supabase.rpc("report_homepage_overview", {
      _trend_days: range,
    });
    if (error) {
      console.error("overview error", error);
      return;
    }
    setData(result as unknown as Overview);
  }, [range]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const trendData = useMemo(
    () =>
      (data?.trend || []).map((point) => ({
        day: new Date(point.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        value: Number(point.net_baisas || 0) / 1000,
      })),
    [data],
  );

  const causes = useMemo(() => {
    const all = data?.causes || [];
    const total = Number(data?.causes_total_baisas || 0);
    const top = all.slice(0, 5);
    const rest = all.slice(5).reduce((sum, c) => sum + Number(c.net_baisas || 0), 0);
    const rows = top.map((c, index) => ({
      name: c.name,
      code: c.code,
      amount: Number(c.net_baisas || 0),
      share: total ? (Number(c.net_baisas || 0) / total) * 100 : 0,
      delta: pctDelta(Number(c.net_baisas || 0), Number(c.prev_net_baisas || 0)),
      color: CAUSE_COLORS[index % CAUSE_COLORS.length],
    }));
    return {
      rows,
      others: { amount: rest, share: total ? (rest / total) * 100 : 0 },
      dominant: rows.find((r) => r.share > 80) || null,
    };
  }, [data]);

  const exportToday = () => {
    const todayMuscat = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
    const rows = (transactions || []).filter(
      (t) => new Date(new Date(t.created_at).getTime() + 4 * 3600_000).toISOString().slice(0, 10) === todayMuscat,
    );
    const headers = ["Reference", "Date (GST)", "Kiosk", "Category", "Amount OMR", "Status", "POS RRN", "Auth code"];
    const csv = [
      headers.join(","),
      ...rows.map((t) =>
        [
          t.reference_number || "",
          new Date(t.created_at).toISOString(),
          t.kiosks?.name || "",
          t.category_reference || t.category || "",
          omr(t.amount_baisas),
          t.status,
          t.pos_rrn || "",
          t.pos_auth_code || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${todayMuscat}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpi = data?.kpi;
  const successRate = kpi?.success_rate ?? null;
  const successLow = successRate !== null && successRate < 60;
  const noKiosks = (kpi?.active_kiosks ?? 0) === 0;
  const attention = data?.attention;

  const issues: { icon: React.ReactNode; title: string; detail: string; action: string; onClick: () => void }[] = [];
  if (attention) {
    const offline = attention.offline_kiosks || [];
    if (offline.length) {
      issues.push({
        icon: <WifiOff className="h-4 w-4" style={{ color: RED }} />,
        title: `${offline.length} kiosk${offline.length === 1 ? "" : "s"} offline`,
        detail: offline
          .slice(0, 2)
          .map((k) => `${k.name}${k.last_seen ? ` · last seen ${new Date(k.last_seen).toLocaleString("en-GB")}` : ""}`)
          .join(" · "),
        action: "Manage kiosks →",
        onClick: () => navigate("/admin/kiosks"),
      });
    }
    if (attention.attention_kiosks > 0) {
      issues.push({
        icon: <MonitorSmartphone className="h-4 w-4" style={{ color: AMBER }} />,
        title: `${attention.attention_kiosks} terminal${attention.attention_kiosks === 1 ? "" : "s"} need attention`,
        detail: "reader or printer reporting a problem",
        action: "Manage kiosks →",
        onClick: () => navigate("/admin/kiosks"),
      });
    }
    if (successLow) {
      issues.push({
        icon: <TrendingUp className="h-4 w-4" style={{ color: AMBER }} />,
        title: `Success rate very low (${successRate?.toFixed(1)}%)`,
        detail: `${attention.last_hour.failed} failed vs ${attention.last_hour.completed} completed in the last hour`,
        action: "View →",
        onClick: () => navigate("/admin/statistics"),
      });
    }
    if (attention.stuck_count > 0) {
      issues.push({
        icon: <Clock className="h-4 w-4" style={{ color: AMBER }} />,
        title: `${attention.stuck_count} transactions pending > 10 min`,
        detail: "re-check via Last Transaction Status",
        action: "Resolve →",
        onClick: () => navigate("/admin/statistics#attention-queue"),
      });
    }
    if (attention.unreconciled_today > 0) {
      issues.push({
        icon: <RefreshCcw className="h-4 w-4" style={{ color: AMBER }} />,
        title: `${attention.unreconciled_today} unreconciled today`,
        detail: "completed payments with no bank reference yet",
        action: "Reconcile →",
        onClick: () => navigate("/admin/statistics"),
      });
    }
    if (attention.receipts_failed_today > 0) {
      issues.push({
        icon: <Activity className="h-4 w-4" style={{ color: RED }} />,
        title: `${attention.receipts_failed_today} receipts failed today`,
        detail: "SMS or WhatsApp delivery failures",
        action: "SMS settings →",
        onClick: () => navigate("/admin/sms-settings"),
      });
    }
    (attention.terminal_conditions || []).forEach((c) => {
      issues.push({
        icon: <MonitorSmartphone className="h-4 w-4" style={{ color: AMBER }} />,
        title: `${c.name}: ${c.paper_ok === false ? "low paper" : "low battery"}`,
        detail: c.paper_ok === false ? "printer reported E006" : "terminal reported E011",
        action: "Manage kiosks →",
        onClick: () => navigate("/admin/kiosks"),
      });
    });
  }

  return (
    <section className="mb-6 rounded-xl border bg-muted p-4 shadow-sm sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Overview</h2>
          <p className="text-xs text-muted-foreground">Recent activity · Muscat time (GST) · settled (net) revenue</p>
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GREEN }} />
          Live · refreshes every 30s
        </span>
      </header>

      {/* Section 1 — KPI row */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total revenue"
          value={omr(kpi?.net_baisas || 0)}
          unit="OMR"
          sublabel="completed · net"
          icon={<Wallet className="h-4 w-4" />}
          accent={GREEN}
        />
        <KpiCard
          label="Transactions"
          value={String(kpi?.attempts ?? 0)}
          sublabel="attempts"
          icon={<CreditCard className="h-4 w-4" />}
        />
        <KpiCard
          label="Success rate"
          value={successRate === null ? "—" : `${successRate.toFixed(1)}%`}
          sublabel="completed ÷ decided"
          icon={<TrendingUp className="h-4 w-4" />}
          accent={successLow ? AMBER : undefined}
          flag={successLow ? "⚠ Unusually low" : undefined}
        />
        <KpiCard
          label="Active kiosks"
          value={String(kpi?.active_kiosks ?? 0)}
          sublabel={`of ${kpi?.registered_kiosks ?? 0} registered`}
          icon={<Activity className="h-4 w-4" />}
          accent={noKiosks ? RED : undefined}
          flag={noKiosks ? "● All offline" : undefined}
        />
      </div>

      {/* Section 2 — momentum + goal */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <MomentumTile
          label="Today"
          value={data?.momentum.today.net_baisas || 0}
          previous={data?.momentum.today.previous_baisas || 0}
          suffix="yesterday"
        />
        <MomentumTile
          label="This week"
          value={data?.momentum.week.net_baisas || 0}
          previous={data?.momentum.week.previous_baisas || 0}
          suffix="last week"
        />
        <MomentumTile
          label="This month"
          value={data?.momentum.month.net_baisas || 0}
          previous={data?.momentum.month.previous_baisas || 0}
          suffix="last month"
        />
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          {data?.target ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">{data.target.name}</p>
                <span className="font-mono text-sm font-bold" style={{ color: GREEN }}>
                  {data.target.amount_baisas
                    ? Math.min(100, (data.target.raised_baisas / data.target.amount_baisas) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{data.target.days_left} days left</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: GREEN,
                    width: `${data.target.amount_baisas ? Math.min(100, (data.target.raised_baisas / data.target.amount_baisas) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Raised <span className="font-mono font-semibold text-foreground">{omr(data.target.raised_baisas)} OMR</span>
                {"  "}· Target <span className="font-mono">{omr(data.target.amount_baisas)} OMR</span>
              </p>
            </>
          ) : (
            <div className="flex h-full flex-col justify-center">
              <p className="text-sm font-semibold">No active target</p>
              <button
                type="button"
                onClick={() => navigate("/admin/statistics")}
                className="mt-1 text-left text-xs font-medium text-primary hover:underline"
              >
                Set a monthly target →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 3 — trend + top causes */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-background p-4 shadow-sm lg:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Revenue trend</h3>
            <div className="inline-flex rounded-lg border p-0.5">
              {([7, 30, 90] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    range === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {option}d
                </button>
              ))}
            </div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Last {range} days ·{" "}
            <span className="font-mono font-semibold text-foreground">{omr(data?.trend_total_baisas || 0)} OMR</span> ·
            chronological · zero-filled (Muscat)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(3)} OMR`, "Net revenue"]} />
              <Area type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-bold">Top causes</h3>
            <span className="text-xs text-muted-foreground">this month · OMR</span>
          </div>
          <ul className="space-y-2">
            {causes.rows.length === 0 && <li className="text-xs text-muted-foreground">No donations yet this month.</li>}
            {causes.rows.map((row) => (
              <li key={row.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="min-w-0 flex-1 truncate">
                  {row.name}
                  {row.code && <span className="ml-1 text-[11px] text-muted-foreground">· {row.code}</span>}
                </span>
                <span className="font-mono tabular-nums">{omr(row.amount)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">{row.share.toFixed(0)}%</span>
                <span
                  className="w-4 text-right text-xs"
                  style={{ color: row.delta === null ? undefined : row.delta >= 0 ? GREEN : RED }}
                >
                  {row.delta === null ? "–" : row.delta >= 0 ? "▲" : "▼"}
                </span>
              </li>
            ))}
            {causes.others.amount > 0 && (
              <li className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">Others</span>
                <span className="font-mono tabular-nums">{omr(causes.others.amount)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">{causes.others.share.toFixed(0)}%</span>
                <span className="w-4" />
              </li>
            )}
          </ul>
          {causes.dominant && (
            <p
              className="mt-3 rounded-lg px-3 py-2 text-[11px]"
              style={{ color: AMBER, backgroundColor: `${AMBER}14` }}
            >
              ⚠ {causes.dominant.share.toFixed(0)}% is “{causes.dominant.name}” — donations are mostly uncategorised.
              Prompt donors to pick a cause.
            </p>
          )}
        </div>
      </div>

      {/* Section 4 — needs attention */}
      <div className="mb-4 rounded-xl border bg-background p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold">Needs attention</h3>
          <span className="text-xs text-muted-foreground">
            {issues.length ? `${issues.length} open` : "all clear"}
          </span>
        </div>
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm" style={{ color: GREEN }}>
            <CheckCircle2 className="h-4 w-4" />
            All systems healthy · kiosks online, receipts delivered, nothing stuck.
          </div>
        ) : (
          <ul className="divide-y">
            {issues.map((issue, index) => (
              <li key={index} className="flex items-center gap-3 py-2">
                <span className="rounded-md bg-muted p-1.5">{issue.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{issue.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{issue.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={issue.onClick}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  {issue.action}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Section 5 — quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={exportToday}>
          <Download className="mr-2 h-4 w-4" />
          Export today (CSV)
        </Button>
        <Button size="sm" variant="outline" className="bg-background" onClick={() => navigate("/admin/statistics")}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Reconcile bank file
        </Button>
        <Button size="sm" variant="outline" className="bg-background" onClick={() => navigate("/admin/kiosks")}>
          <MonitorSmartphone className="mr-2 h-4 w-4" />
          Manage kiosks
        </Button>
      </div>
    </section>
  );
};

export default HomeCommandCentre;
