import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, CreditCard, TrendingUp, Activity, 
  LogOut, RefreshCw, Settings, BarChart3, Users
} from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { AdminHeader } from "@/components/admin/AdminHeader";
import awqafLogo from "@/assets/awkaflogo-3.png.asset.json";
import TransactionsFinanceTable from "@/components/admin/TransactionsFinanceTable";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    successRate: 0,
    activeKiosks: 0,
  });

  useEffect(() => {
    let mounted = true;

    const initializeAdmin = async () => {
      const isAuthenticated = await checkAuth();
      if (isAuthenticated && mounted) {
        await loadData();
      }
    };

    initializeAdmin();

    // Poll for new transactions (realtime broadcast disabled to prevent PII leakage to subscribers)
    const pollInterval = setInterval(() => {
      if (mounted) loadTransactions();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    try {
      // First ensure we have a fresh session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        navigate("/auth", { replace: true });
        return false;
      }
      
      if (!session) {
        navigate("/auth", { replace: true });
        return false;
      }

      // Check if user has admin or super_admin role
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .in('role', ['admin', 'super_admin']);

      if (error) {
        console.error('Role check error:', error);
        // Don't sign out immediately on error - could be transient
        toast({
          title: "Access Error",
          description: "Could not verify admin privileges. Please try again.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return false;
      }

      if (!roles || roles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth", { replace: true });
        return false;
      }

      setUser(session.user);
      
      // Check if super admin
      const hasSuperAdminRole = roles.some(r => r.role === 'super_admin');
      setIsSuperAdmin(hasSuperAdminRole);
      
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setProfile(profileData);
      
      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      navigate("/auth", { replace: true });
      return false;
    }
  };

  const loadData = async () => {
    await Promise.all([
      loadTransactions(),
      loadKiosks(),
    ]);
    setLoading(false);
  };

  const loadTransactions = async () => {
    const pageSize = 1000;
    const allTransactions: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('transactions')
        .select(`*, kiosks (name, location, reference_number)`)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error loading transactions:', error);
        return;
      }

      allTransactions.push(...(data || []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    setTransactions(allTransactions);
    calculateStats(allTransactions);
  };

  const loadKiosks = async () => {
    const { data, error } = await supabase
      .from('kiosks')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading kiosks:', error);
      return;
    }

    setKiosks(data || []);
  };

  const calculateStats = (txns: any[]) => {
    const completed = txns.filter(t => t.status === 'completed');
    const totalRevenue = completed.reduce((sum, t) => sum + t.amount_baisas, 0);
    const successRate = txns.length > 0 ? (completed.length / txns.length) * 100 : 0;
    const activeKiosks = kiosks.filter(k => k.status === 'active').length;

    setStats({
      totalRevenue,
      totalTransactions: txns.length,
      successRate,
      activeKiosks,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatAmount = (baisas: number) => {
    const rials = Math.floor(baisas / 1000);
    const remainingBaisas = baisas % 1000;
    return `${rials}.${remainingBaisas.toString().padStart(3, '0')} OMR`;
  };

  // Chart data
  const categoryData = transactions.reduce((acc: any[], t) => {
    const existing = acc.find(item => item.name === t.category);
    if (existing) {
      existing.value += t.amount_baisas;
      existing.count += 1;
    } else {
      acc.push({ name: t.category, value: t.amount_baisas, count: 1 });
    }
    return acc;
  }, []);

  const dailyData = transactions
    .filter(t => t.status === 'completed')
    .reduce((acc: any[], t) => {
      const date = new Date(t.created_at).toLocaleDateString();
      const existing = acc.find(item => item.date === date);
      if (existing) {
        existing.amount += t.amount_baisas / 1000;
        existing.transactions += 1;
      } else {
        acc.push({ date, amount: t.amount_baisas / 1000, transactions: 1 });
      }
      return acc;
    }, [])
    .slice(-7);

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="admin-panel transactions-finance min-h-screen bg-muted text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img
                src={awqafLogo.url}
                alt="Awqaf Al Lawatia"
                className="h-10 w-auto object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
                {profile?.full_name && (
                  <p className="text-sm text-muted-foreground">Welcome, {profile.full_name}</p>
                )}
                <p className="text-xs text-muted-foreground">Kiosk Management System</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <ThemeToggle />
              <AdminHeader />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
          
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/categories')}>
              <Settings className="mr-2 h-4 w-4" />
              Manage Categories
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/kiosks')}>
              <Activity className="mr-2 h-4 w-4" />
              Manage Kiosks
            </Button>
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/admins')}>
                <Users className="mr-2 h-4 w-4" />
                Manage Admins
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/statistics')}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Enhanced Statistics
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/sms-settings')}>
              <Settings className="mr-2 h-4 w-4" />
              SMS Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/whatsapp-settings')}>
              <Settings className="mr-2 h-4 w-4" />
              WhatsApp Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatAmount(stats.totalRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">{stats.totalTransactions}</p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Kiosks</p>
                <p className="text-2xl font-bold">{stats.activeKiosks}</p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Revenue (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#10b981" name="Revenue (OMR)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatAmount(value)} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="kiosks">Kiosks</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <TransactionsFinanceTable transactions={transactions} kiosks={kiosks} isSuperAdmin={isSuperAdmin} />
          </TabsContent>

          <TabsContent value="kiosks">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Kiosk Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kiosks.map((kiosk) => (
                    <Card key={kiosk.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{kiosk.name}</h4>
                        <Badge variant={kiosk.status === 'active' ? 'default' : 'secondary'}>
                          {kiosk.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{kiosk.location}</p>
                      {kiosk.last_heartbeat && (
                        <p className="text-xs text-muted-foreground">
                          Last seen: {new Date(kiosk.last_heartbeat).toLocaleString()}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;