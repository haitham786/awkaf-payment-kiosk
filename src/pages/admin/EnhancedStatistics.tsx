import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Mail, Printer } from "lucide-react";
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

  useEffect(() => {
    checkAuth();
    loadData();
  }, [timeFilter, selectedKiosk]);

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

      const { data, error } = await query;
      if (error) throw error;

      setTransactions(data || []);

      // Load kiosks
      const { data: kiosksData } = await supabase
        .from('kiosks')
        .select('*');
      setKiosks(kiosksData || []);
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
      const category = t.category || 'unknown';
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
    // Create CSV content
    const headers = ['Date', 'Time', 'Reference', 'Category', 'Amount (OMR)', 'Kiosk'];
    const rows = transactions.map(t => [
      new Date(t.created_at).toLocaleDateString('en-GB'),
      new Date(t.created_at).toLocaleTimeString('en-GB'),
      t.reference_number || 'N/A',
      t.category,
      ((t.amount_baisas || 0) / 1000).toFixed(3),
      t.kiosks?.name || 'N/A'
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
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <label className="text-sm font-medium mb-2 block">Time Period</label>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
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