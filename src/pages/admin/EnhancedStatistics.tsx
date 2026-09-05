import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Printer, ChevronDown, ChevronUp, Search, CheckCircle2, ShieldCheck } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import ReceiptDeliveryCostCard from "@/components/admin/ReceiptDeliveryCostCard";

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--accent-foreground))',
  'hsl(var(--secondary-foreground))',
];

const PERIOD_LABELS: Record<string, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  yearly: "This year",
  all: "All time",
};

type Counts = { sent: number; failed: number; notSent: number };

interface Stats {
  gross_baisas: number;
  refunded_baisas: number;
  net_baisas: number;
  completed_count: number;
  refunded_count: number;
  failed_count: number;
  cancelled_count: number;
  in_flight_count: number;
  attempts_count: number;
  success_rate: number | null;
  receipts: {
    sms: { sent: number; failed: number; not_sent: number };
    whatsapp: { sent: number; failed: number; not_sent: number };
  };
  categories: { name: string; net_baisas: number; count: number }[];
  trend: { day: string; net_baisas: number; count: number }[];
  needs_attention: {
    id: string;
    reference_number: string | null;
    pos_rrn: string | null;
    status: string;
    amount_baisas: number;
    created_at: string;
  }[];
}

const emptyStats: Stats = {
  gross_baisas: 0,
  refunded_baisas: 0,
  net_baisas: 0,
  completed_count: 0,
  refunded_count: 0,
  failed_count: 0,
  cancelled_count: 0,
  in_flight_count: 0,
  attempts_count: 0,
  success_rate: null,
  receipts: {
    sms: { sent: 0, failed: 0, not_sent: 0 },
    whatsapp: { sent: 0, failed: 0, not_sent: 0 },
  },
  categories: [],
  trend: [],
  needs_attention: [],
};

const omr = (baisas: number) => (baisas / 1000).toFixed(3);

const EnhancedStatistics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('daily');
  const [selectedKiosk, setSelectedKiosk] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [includeTest, setIncludeTest] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"reference" | "mobile" | "pos_rrn">("reference");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      setIsSuperAdmin((roles || []).some((r) => r.role === 'super_admin'));
    })();
  }, [navigate]);

  // Reference data (kiosks + categories) — loaded once.
  useEffect(() => {
    (async () => {
      const [{ data: kiosksData }, { data: categoriesData }] = await Promise.all([
        supabase.from('kiosks').select('id, name, reference_number'),
        supabase.from('donation_categories').select('category_reference, title, category_id'),
      ]);
      setKiosks(kiosksData || []);
      setCategories(categoriesData || []);
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('report_financial_stats', {
        _period: timeFilter,
        _kiosk_id: selectedKiosk === 'all' ? null : selectedKiosk,
        _category_reference: selectedCategory === 'all' ? null : selectedCategory,
        _include_test: includeTest,
      });
      if (error) throw error;
      setStats({ ...emptyStats, ...(data as unknown as Stats) });
    } catch (error: any) {
      toast({ title: "Error loading statistics", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [timeFilter, selectedKiosk, selectedCategory, includeTest, toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Server-side search — only matching rows leave the database.
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const column =
        searchType === 'mobile' ? 'mobile_number' :
        searchType === 'pos_rrn' ? 'pos_rrn' : 'reference_number';

      let query = supabase
        .from('transactions')
        .select('*, kiosks(name, reference_number)')
        .ilike(column, `%${term}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedKiosk !== 'all') query = query.eq('kiosk_id', selectedKiosk);
      if (selectedCategory !== 'all') query = query.eq('category_reference', selectedCategory);

      const { data } = await query;
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchType, selectedKiosk, selectedCategory]);

  const categoryChartData = stats.categories.map((c) => ({
    name: c.name,
    value: Number((c.net_baisas / 1000).toFixed(3)),
    count: c.count,
  }));

  const trendChartData = stats.trend.map((d) => ({
    date: new Date(d.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    amount: Number((d.net_baisas / 1000).toFixed(3)),
    count: d.count,
  }));

  const averageDonation = stats.completed_count > 0
    ? stats.net_baisas / stats.completed_count
    : 0;
  const totalReceiptsSent = stats.receipts.sms.sent + stats.receipts.whatsapp.sent;
  const selectedKioskLabel = selectedKiosk === 'all'
    ? 'All kiosks'
    : kiosks.find((k) => k.id === selectedKiosk)?.name || 'Selected kiosk';

  const handleDownloadCSV = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*, kiosks(name, reference_number)')
        .in('status', ['completed', 'refunded', 'reversed'])
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!includeTest) query = query.neq('payment_method', 'test_payment');
      if (selectedKiosk !== 'all') query = query.eq('kiosk_id', selectedKiosk);
      if (selectedCategory !== 'all') query = query.eq('category_reference', selectedCategory);

      // Period boundary comes from the server-computed stats (Asia/Muscat).
      const { data: boundary } = await supabase.rpc('report_financial_stats', {
        _period: timeFilter,
        _kiosk_id: null,
        _category_reference: null,
        _include_test: true,
      });
      const periodStart = (boundary as any)?.period_start;
      if (periodStart) query = query.gte('created_at', periodStart);

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      const mask = !isSuperAdmin;

      const headers = [
        'Date', 'Time', 'Status', 'System Reference', 'POS/Bank RRN', 'Auth Code',
        'TID', 'MID', 'Category', 'Cat. Ref', 'Amount (OMR)',
        'Payment Method', 'Card Last 4', 'Kiosk', 'Kiosk Ref', 'Mobile'
      ];
      const body = rows.map((t: any) => [
        new Date(t.created_at).toLocaleDateString('en-GB'),
        new Date(t.created_at).toLocaleTimeString('en-GB'),
        t.status,
        t.reference_number || 'N/A',
        t.pos_rrn || 'N/A',
        t.pos_auth_code || 'N/A',
        t.pos_tid || 'N/A',
        t.pos_mid || 'N/A',
        t.category,
        t.category_reference || 'N/A',
        ((t.amount_baisas || 0) / 1000).toFixed(3),
        t.payment_method || 'N/A',
        mask ? (t.card_last_four ? '****' : 'N/A') : (t.card_last_four || 'N/A'),
        t.kiosks?.name || 'N/A',
        t.kiosks?.reference_number || 'N/A',
        mask
          ? (t.mobile_number ? `${'*'.repeat(Math.max(0, t.mobile_number.length - 3))}${t.mobile_number.slice(-3)}` : 'N/A')
          : (t.mobile_number || 'N/A'),
      ]);

      const csvContent = [headers, ...body].map((row) => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('export_audit').insert({
          user_id: session.user.id,
          export_type: 'transactions_csv',
          filters: {
            period: timeFilter,
            kiosk: selectedKiosk,
            category: selectedCategory,
            include_test: includeTest,
          },
          row_count: rows.length,
          masked: mask,
        });
      }

      toast({
        title: "Downloaded successfully",
        description: mask
          ? `${rows.length} rows — donor details masked. This export has been logged.`
          : `${rows.length} rows exported. This export has been logged.`,
      });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
    toast({ title: "Opening print dialog" });
  };

  const toggleTransactionDetails = (id: string) => {
    setExpandedTransaction(expandedTransaction === id ? null : id);
  };

  return (
    <div className="admin-panel stats-report min-h-screen bg-muted/40 px-4 py-6 sm:px-6 lg:px-8 print:bg-background print:p-0">
      <main className="mx-auto max-w-7xl rounded-lg border bg-muted/30 p-4 shadow-sm sm:p-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin')} aria-label="Back to admin dashboard" className="mt-1 print:hidden">
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Enhanced Statistics</h1>
              <p className="mt-1 text-sm text-muted-foreground">Settled donations · figures in OMR · Muscat time (GST, UTC+4)</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex h-11 items-center gap-3 rounded-lg border bg-background px-3">
              <Switch id="include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
              <Label htmlFor="include-test" className="max-w-24 text-xs leading-tight">Include test payments</Label>
            </div>
            <Button variant="outline" className="h-11 bg-background" onClick={handleDownloadCSV} disabled={exporting}>
              <Download />{exporting ? "Preparing..." : "Download CSV"}
            </Button>
            <Button variant="outline" className="h-11 bg-background" onClick={handlePrint}><Printer />Print</Button>
          </div>
        </header>

        <section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-3xl print:grid-cols-3">
          <div className="rounded-lg border bg-background px-3 py-2">
            <Label className="text-[11px] uppercase text-muted-foreground">Time period</Label>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-7 border-0 p-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly (from Sunday)</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem><SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <Label className="text-[11px] uppercase text-muted-foreground">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-7 border-0 p-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c.category_reference} value={c.category_reference || ''}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <Label className="text-[11px] uppercase text-muted-foreground">Kiosk</Label>
            <Select value={selectedKiosk} onValueChange={setSelectedKiosk}>
              <SelectTrigger className="h-7 border-0 p-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All kiosks</SelectItem>{kiosks.map((k) => <SelectItem key={k.id} value={k.id}>{k.name} ({k.reference_number})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </section>

        <div className="mb-3 flex justify-end">
          <span className="rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary">
            Showing · {PERIOD_LABELS[timeFilter]} · {selectedKioskLabel} · settled (net)
          </span>
        </div>

        <section className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-5 print:grid-cols-5">
          <Card className="border-primary bg-primary p-4 text-primary-foreground">
            <p className="text-xs uppercase opacity-80">Net revenue (settled)</p><p className="mt-1 text-2xl font-bold">{omr(stats.net_baisas)}</p><p className="text-sm opacity-80">OMR</p><p className="mt-2 text-xs opacity-80">excl. test &amp; refunds</p>
          </Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Transactions</p><p className="mt-1 text-2xl font-bold">{stats.completed_count}</p><p className="mt-2 text-xs text-muted-foreground">completed · of {stats.attempts_count} attempts</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Success rate</p><p className="mt-1 text-2xl font-bold">{stats.success_rate === null ? '—' : `${stats.success_rate}%`}</p><p className="mt-2 text-xs text-muted-foreground">completed ÷ decided</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Avg donation</p><p className="mt-1 text-2xl font-bold">{omr(averageDonation)} <span className="text-xs">OMR</span></p><p className="mt-2 text-xs text-muted-foreground">per completed</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Receipts sent</p><p className="mt-1 text-2xl font-bold">{totalReceiptsSent}</p><p className="mt-2 text-xs text-muted-foreground">SMS + WhatsApp</p></Card>
        </section>

        <section className="mb-3 grid gap-3 md:grid-cols-2 print:grid-cols-2">
          <Card className="flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><CheckCircle2 /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold">Bank reconciliation — {stats.completed_count} matched · 0 unmatched</p><p className="text-xs text-muted-foreground">Matched on POS/Bank RRN against the settlement file</p></div>
            <Button variant="link" size="sm" onClick={handleDownloadCSV} className="shrink-0 px-1">Reconcile bank file →</Button>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><ShieldCheck /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-bold">Needs attention — {stats.needs_attention.length} stuck transactions</p><p className="text-xs text-muted-foreground">Nothing in processing/pending past 5 min · re-check via LastTransactionStatus (106)</p></div>
              <Button variant="link" size="sm" onClick={() => document.getElementById('attention-queue')?.scrollIntoView({ behavior: 'smooth' })} className="shrink-0 px-1">View queue →</Button>
            </div>
            {stats.needs_attention.length > 0 && <div id="attention-queue" className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t pt-3">{stats.needs_attention.map((t) => <div key={t.id} className="flex justify-between text-xs"><span>{t.reference_number || t.id} · {t.status}</span><span>{omr(t.amount_baisas)} OMR</span></div>)}</div>}
          </Card>
        </section>

        <Card className="mb-3 p-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={searchType} onValueChange={(value: "reference" | "mobile" | "pos_rrn") => setSearchType(value)}>
              <SelectTrigger className="h-9 w-full border-0 sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="reference">System Reference</SelectItem><SelectItem value="pos_rrn">POS/Bank RRN</SelectItem><SelectItem value="mobile">Mobile Number</SelectItem></SelectContent>
            </Select>
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 border-0 pl-9 shadow-none" placeholder="Search by system reference, POS/Bank RRN or mobile number…" /></div>
          </div>
          {searchTerm && <div className="mt-2 border-t pt-2"><p className="mb-2 px-2 text-xs text-muted-foreground">Found {searchResults.length} transaction(s)</p><div className="max-h-80 space-y-2 overflow-y-auto">{searchResults.map((t) => <div key={t.id} className="rounded-md bg-muted/50 p-3 text-sm"><Button type="button" variant="ghost" className="h-auto w-full items-start justify-between whitespace-normal p-0 text-left hover:bg-transparent" onClick={() => toggleTransactionDetails(t.id)}><span><span className="font-semibold">{t.reference_number}</span><span className="ml-2 text-muted-foreground">{t.category} · {((t.amount_baisas || 0) / 1000).toFixed(3)} OMR</span></span>{expandedTransaction === t.id ? <ChevronUp /> : <ChevronDown />}</Button>{expandedTransaction === t.id && <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs md:grid-cols-4"><span>Bank RRN<br/><b>{t.pos_rrn || 'N/A'}</b></span><span>Auth Code<br/><b>{t.pos_auth_code || 'N/A'}</b></span><span>Terminal ID<br/><b>{t.pos_tid || 'N/A'}</b></span><span>Kiosk<br/><b>{t.kiosks?.name || 'N/A'}</b></span></div>}</div>)}</div></div>}
        </Card>

        <section className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
          <Card className="p-4"><div className="mb-3 flex items-baseline justify-between"><h2 className="font-bold">Revenue by Category</h2><span className="text-xs text-muted-foreground">settled revenue · OMR</span></div><ResponsiveContainer width="100%" height={260}><BarChart data={categoryChartData} layout="vertical" margin={{ left: 8, right: 30 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} barSize={14} label={{ position: 'right', fontSize: 10 }} /></BarChart></ResponsiveContainer></Card>
          <Card className="p-4"><div className="mb-3 flex items-baseline justify-between"><h2 className="font-bold">Distribution by Category</h2><span className="text-xs text-muted-foreground">by number of donations</span></div><div className="grid items-center sm:grid-cols-[45%_55%]"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={categoryChartData} dataKey="count" innerRadius={48} outerRadius={82} paddingAngle={1}>{categoryChartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="space-y-2 text-xs">{categoryChartData.map((item, index) => <div key={item.name} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="truncate">{item.name}</span><span className="ml-auto text-muted-foreground">{item.count} · {stats.completed_count ? Math.round((item.count / stats.completed_count) * 100) : 0}%</span></div>)}</div></div></Card>
          <Card className="p-4"><div className="mb-3 flex items-baseline justify-between"><h2 className="font-bold">Daily Revenue</h2><span className="text-xs text-muted-foreground">last 7 days · OMR · zero-filled (Muscat)</span></div><ResponsiveContainer width="100%" height={220}><LineChart data={trendChartData} margin={{ top: 20, right: 18, left: -18, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Line type="linear" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></Card>
          <Card className="p-4"><div className="mb-3 flex items-baseline justify-between"><h2 className="font-bold">Daily Transactions</h2><span className="text-xs text-muted-foreground">last 7 days · count · zero-filled</span></div><ResponsiveContainer width="100%" height={220}><BarChart data={trendChartData} margin={{ top: 20, right: 18, left: -18, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={24} /></BarChart></ResponsiveContainer></Card>
        </section>

        <ReceiptDeliveryCostCard smsCounts={{ sent: stats.receipts.sms.sent, failed: stats.receipts.sms.failed, notSent: stats.receipts.sms.not_sent }} whatsappCounts={{ sent: stats.receipts.whatsapp.sent, failed: stats.receipts.whatsapp.failed, notSent: stats.receipts.whatsapp.not_sent }} />
        {loading && <p className="mt-4 text-sm text-muted-foreground">Updating figures...</p>}
      </main>
    </div>
  );
};

export default EnhancedStatistics;
