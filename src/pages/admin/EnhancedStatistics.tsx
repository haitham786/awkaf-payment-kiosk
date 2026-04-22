import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Printer, ChevronDown, ChevronUp, Search } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const EnhancedStatistics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('daily');
  const [selectedKiosk, setSelectedKiosk] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"reference" | "mobile" | "pos_rrn">("reference");
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    loadData();
  }, [timeFilter, selectedKiosk, selectedCategory]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = transactions.filter((t) => {
        if (searchType === "mobile") {
          return t.mobile_number?.includes(searchTerm);
        }
        if (searchType === "pos_rrn") {
          return t.pos_rrn?.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return t.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions(transactions);
    }
  }, [searchTerm, searchType, transactions]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
  };

  const loadData = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select('*, kiosks(name, reference_number)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      // Apply time filter
      const now = new Date();
      if (timeFilter === 'daily') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        query = query.gte('created_at', startOfDay.toISOString());
      } else if (timeFilter === 'weekly') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startOfWeek.toISOString());
      } else if (timeFilter === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', startOfMonth.toISOString());
      } else if (timeFilter === 'yearly') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        query = query.gte('created_at', startOfYear.toISOString());
      }

      // Apply kiosk filter
      if (selectedKiosk !== 'all') {
        query = query.eq('kiosk_id', selectedKiosk);
      }

      // Apply category filter
      if (selectedCategory !== 'all') {
        query = query.eq('category_reference', selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Load categories for mapping
      const { data: categoriesData } = await supabase
        .from('donation_categories')
        .select('category_reference, title, category_id')
        .eq('is_visible', true);
      
      // Create a map of category references to titles
      const categoryMap = new Map(
        categoriesData?.map(c => [c.category_reference, c.title]) || []
      );

      // Enrich transactions with category titles
      const enrichedTransactions = (data || []).map(t => ({
        ...t,
        category_title: categoryMap.get(t.category_reference) || t.category
      }));

      setTransactions(enrichedTransactions);

      // Load kiosks
      const { data: kiosksData } = await supabase
        .from('kiosks')
        .select('*');
      setKiosks(kiosksData || []);

      setCategories(categoriesData || []);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount_baisas || 0), 0) / 1000;
    const totalTransactions = transactions.length;
    
    // Group by category
    const categoryData = transactions.reduce((acc: any, t) => {
      const category = t.category_title || t.category || 'unknown';
      if (!acc[category]) {
        acc[category] = { name: category, value: 0, count: 0 };
      }
      acc[category].value += (t.amount_baisas || 0) / 1000;
      acc[category].count += 1;
      return acc;
    }, {});

    // Group by date
    const dateData = transactions.reduce((acc: any, t) => {
      const date = new Date(t.created_at).toLocaleDateString('en-GB');
      if (!acc[date]) {
        acc[date] = { date, amount: 0, count: 0 };
      }
      acc[date].amount += (t.amount_baisas || 0) / 1000;
      acc[date].count += 1;
      return acc;
    }, {});

    return {
      totalRevenue,
      totalTransactions,
      categoryData: Object.values(categoryData),
      dateData: Object.values(dateData),
    };
  };

  const stats = calculateStats();

  const handleDownloadXLSX = () => {
    // Create CSV content with dual reference columns
    const headers = [
      'Date', 'Time', 'System Reference', 'POS/Bank RRN', 'Auth Code', 
      'TID', 'MID', 'Category', 'Cat. Ref', 'Amount (OMR)', 
      'Payment Method', 'Card Last 4', 'Kiosk', 'Kiosk Ref', 'Mobile'
    ];
    const rows = transactions.map(t => [
      new Date(t.created_at).toLocaleDateString('en-GB'),
      new Date(t.created_at).toLocaleTimeString('en-GB'),
      t.reference_number || 'N/A',
      t.pos_rrn || 'N/A',
      t.pos_auth_code || 'N/A',
      t.pos_tid || 'N/A',
      t.pos_mid || 'N/A',
      t.category_title || t.category,
      t.category_reference || 'N/A',
      ((t.amount_baisas || 0) / 1000).toFixed(3),
      t.payment_method || 'N/A',
      t.card_last_four || 'N/A',
      t.kiosks?.name || 'N/A',
      t.kiosks?.reference_number || 'N/A',
      t.mobile_number || 'N/A'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast({ title: "Downloaded successfully" });
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
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Enhanced Statistics</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDownloadXLSX}>
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div>
            <label className="text-sm font-medium mb-2 block">Time Period</label>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
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
                Found {filteredTransactions.length} transaction(s)
              </p>
              {filteredTransactions.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredTransactions.map(t => (
                    <div key={t.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                      <div 
                        className="flex justify-between items-start cursor-pointer"
                        onClick={() => toggleTransactionDetails(t.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{t.reference_number}</p>
                            {expandedTransaction === t.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            {t.category_title || t.category} • {((t.amount_baisas || 0) / 1000).toFixed(3)} OMR
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold text-primary">{stats.totalRevenue.toFixed(3)} OMR</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Transactions</h3>
            <p className="text-3xl font-bold text-success">{stats.totalTransactions}</p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bar Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Revenue by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Revenue (OMR)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pie Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Distribution by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats.categoryData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Daily/Monthly Trend */}
        {stats.dateData.length > 0 && (
          <Card className="p-6 mt-8">
            <h3 className="text-lg font-bold mb-4">Transaction Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.dateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="amount" fill="#82ca9d" name="Amount (OMR)" />
                <Bar dataKey="count" fill="#8884d8" name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EnhancedStatistics;
