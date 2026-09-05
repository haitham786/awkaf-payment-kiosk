import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Printer, ChevronDown, ChevronUp, Search, AlertTriangle } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ReceiptDeliveryCostCard from "@/components/admin/ReceiptDeliveryCostCard";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Enhanced Statistics</h1>
              <p className="text-sm text-muted-foreground">
                {PERIOD_LABELS[timeFilter]} · settled revenue, Asia/Muscat
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDownloadCSV} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Preparing..." : "Download CSV"}
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Time Period</label>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly (from Sunday)</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.category_reference} value={c.category_reference || ''}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Kiosk</label>
            <Select value={selectedKiosk} onValueChange={setSelectedKiosk}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Kiosks</SelectItem>
                {kiosks.map(k => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name} ({k.reference_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-8 rounded-lg border p-3">
          <Switch id="include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
          <Label htmlFor="include-test" className="text-sm">
            Include test payments
            <span className="block text-xs text-muted-foreground">
              Off by default — test transactions are excluded from all figures.
            </span>
          </Label>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Net Settled Revenue</h3>
            <p className="text-3xl font-bold text-primary">{omr(stats.net_baisas)} OMR</p>
            <p className="text-xs text-muted-foreground mt-1">
              Gross {omr(stats.gross_baisas)} − refunds {omr(stats.refunded_baisas)}
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed Transactions</h3>
            <p className="text-3xl font-bold text-success">{stats.completed_count}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.attempts_count} attempts in period</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Success Rate</h3>
            <p className="text-3xl font-bold">
              {stats.success_rate === null ? '—' : `${stats.success_rate}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Completed ÷ (completed + failed + cancelled)
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Refunds &amp; Reversals</h3>
            <p className="text-3xl font-bold text-destructive">{stats.refunded_count}</p>
            <p className="text-xs text-muted-foreground mt-1">{omr(stats.refunded_baisas)} OMR deducted</p>
          </Card>
        </div>

        {/* Needs attention */}
        {stats.needs_attention.length > 0 && (
          <Card className="p-6 mb-8 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-lg font-bold">Needs attention</h3>
              <Badge variant="secondary">{stats.needs_attention.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Payments still in progress after 15 minutes. Re-check them against the bank using the RRN.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.needs_attention.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-3 text-sm">
                  <div>
                    <p className="font-semibold">{t.reference_number || t.id}</p>
                    <p className="text-xs text-muted-foreground">
                      RRN {t.pos_rrn || 'not received'} · {new Date(t.created_at).toLocaleString('en-GB')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{omr(t.amount_baisas || 0)} OMR</span>
                    <Badge variant="outline" className="capitalize">{t.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Receipt delivery & estimated messaging cost */}
        <ReceiptDeliveryCostCard
          smsCounts={{
            sent: stats.receipts.sms.sent,
            failed: stats.receipts.sms.failed,
            notSent: stats.receipts.sms.not_sent,
          }}
          whatsappCounts={{
            sent: stats.receipts.whatsapp.sent,
            failed: stats.receipts.whatsapp.failed,
            notSent: stats.receipts.whatsapp.not_sent,
          }}
        />

        {/* Search with Dual Reference Support */}
        <Card className="p-4 mb-8">
          <div className="flex items-center gap-4">
            <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reference">System Reference</SelectItem>
                <SelectItem value="pos_rrn">POS/Bank RRN</SelectItem>
                <SelectItem value="mobile">Mobile Number</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={
                  searchType === "mobile"
                    ? "Search by mobile number..."
                    : searchType === "pos_rrn"
                    ? "Search by POS/Bank RRN (for bank reconciliation)..."
                    : "Search by system reference number..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {searchTerm && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Found {searchResults.length} transaction(s)
              </p>
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map(t => (
                    <div key={t.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                      <div
                        className="flex justify-between items-start cursor-pointer"
                        onClick={() => toggleTransactionDetails(t.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{t.reference_number}</p>
                            <Badge variant="outline" className="capitalize">{t.status}</Badge>
                            {expandedTransaction === t.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            {t.category} • {((t.amount_baisas || 0) / 1000).toFixed(3)} OMR
                          </p>
                          {t.mobile_number && (
                            <p className="text-muted-foreground">Mobile: {t.mobile_number}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleDateString('en-GB')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleTimeString('en-GB')}
                          </p>
                        </div>
                      </div>

                      {/* Expanded POS Details */}
                      {expandedTransaction === t.id && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">
                            POS / Bank Reference Details
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Bank RRN</p>
                              <p className="font-medium">{t.pos_rrn || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Auth Code</p>
                              <p className="font-medium">{t.pos_auth_code || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Terminal ID</p>
                              <p className="font-medium">{t.pos_tid || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Merchant ID</p>
                              <p className="font-medium">{t.pos_mid || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Payment Method</p>
                              <p className="font-medium">{t.payment_method || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Card Last 4</p>
                              <p className="font-medium">{t.card_last_four ? `****${t.card_last_four}` : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Response Code</p>
                              <p className="font-medium">{t.pos_response_code || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Kiosk</p>
                              <p className="font-medium">{t.kiosks?.name || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Net Revenue by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Net Revenue (OMR)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Distribution by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {categoryChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Trend */}
        {trendChartData.length > 0 && (
          <Card className="p-6 mt-8">
            <h3 className="text-lg font-bold mb-1">Transaction Trend</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Calendar days in Asia/Muscat — quiet days show as zero.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="amount" fill="#82ca9d" name="Net Amount (OMR)" />
                <Bar dataKey="count" fill="#8884d8" name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {loading && (
          <p className="mt-6 text-sm text-muted-foreground">Updating figures...</p>
        )}
      </div>
    </div>
  );
};

export default EnhancedStatistics;
