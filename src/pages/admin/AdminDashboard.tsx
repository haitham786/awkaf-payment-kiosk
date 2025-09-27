import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Monitor, 
  Activity, 
  DollarSign, 
  Users, 
  Settings, 
  BarChart3,
  Smartphone,
  WifiOff,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Download
} from "lucide-react";

const AdminDashboard = () => {
  const [selectedKiosk, setSelectedKiosk] = useState("all");

  // Mock data - in real app this would come from API
  const kiosks = [
    { id: "kiosk-1", name: "Main Gate Kiosk", location: "Masjid Main Entrance", status: "online", lastSync: "2 min ago", todayTotal: 2450.75 },
    { id: "kiosk-2", name: "Prayer Hall Kiosk", location: "Prayer Hall 2", status: "online", lastSync: "1 min ago", todayTotal: 1890.25 },
    { id: "kiosk-3", name: "Community Center", location: "Community Hall", status: "offline", lastSync: "15 min ago", todayTotal: 850.00 },
  ];

  const recentTransactions = [
    { id: "TXN001", kiosk: "Main Gate Kiosk", amount: 50.000, category: "Zakat", time: "10:30 AM", status: "completed" },
    { id: "TXN002", kiosk: "Prayer Hall Kiosk", amount: 25.500, category: "Sadaqah", time: "10:25 AM", status: "completed" },
    { id: "TXN003", kiosk: "Main Gate Kiosk", amount: 100.000, category: "Mosque", time: "10:20 AM", status: "completed" },
    { id: "TXN004", kiosk: "Community Center", amount: 75.000, category: "Charity", time: "10:15 AM", status: "failed" },
    { id: "TXN005", kiosk: "Prayer Hall Kiosk", amount: 200.000, category: "Education", time: "10:10 AM", status: "completed" },
  ];

  const categories = [
    { id: "zakat", name: "Zakat", nameArabic: "زكاة", enabled: true, todayCount: 45, todayAmount: 2250.50 },
    { id: "sadaqah", name: "Sadaqah", nameArabic: "صدقة", enabled: true, todayCount: 38, todayAmount: 1890.75 },
    { id: "charity", name: "Charity", nameArabic: "خيرية", enabled: true, todayCount: 22, todayAmount: 1100.25 },
    { id: "mosque", name: "Mosque", nameArabic: "مسجد", enabled: true, todayCount: 15, todayAmount: 750.00 },
    { id: "orphans", name: "Orphans", nameArabic: "أيتام", enabled: true, todayCount: 12, todayAmount: 600.00 },
    { id: "education", name: "Education", nameArabic: "تعليم", enabled: false, todayCount: 0, todayAmount: 0 },
  ];

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(3)} OMR`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <Wifi className="w-4 h-4 text-success" />;
      case "offline":
        return <WifiOff className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Online</Badge>;
      case "offline":
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getTransactionStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 ltr">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Donation Kiosk Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage your donation kiosks</p>
          </div>
          <div className="flex space-x-4">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Button size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Today</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(5190.75)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-success mr-1" />
              <span className="text-sm text-success">+12.5% from yesterday</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Kiosks</p>
                <p className="text-2xl font-bold text-primary">2/3</p>
              </div>
              <Monitor className="w-8 h-8 text-primary" />
            </div>
            <div className="flex items-center mt-2">
              <AlertTriangle className="w-4 h-4 text-warning mr-1" />
              <span className="text-sm text-warning">1 kiosk offline</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold text-primary">132</p>
              </div>
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <div className="flex items-center mt-2">
              <CheckCircle className="w-4 h-4 text-success mr-1" />
              <span className="text-sm text-success">98.5% success rate</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SMS Receipts</p>
                <p className="text-2xl font-bold text-primary">89</p>
              </div>
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <div className="flex items-center mt-2">
              <Activity className="w-4 h-4 text-muted-foreground mr-1" />
              <span className="text-sm text-muted-foreground">67% opted-in</span>
            </div>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="kiosks">Kiosks</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kiosk Status */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Kiosk Status</h3>
                <div className="space-y-4">
                  {kiosks.map((kiosk) => (
                    <div key={kiosk.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(kiosk.status)}
                        <div>
                          <p className="font-medium">{kiosk.name}</p>
                          <p className="text-sm text-muted-foreground">{kiosk.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(kiosk.status)}
                        <p className="text-sm text-muted-foreground mt-1">
                          Today: {formatCurrency(kiosk.todayTotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recent Transactions */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
                <div className="space-y-3">
                  {recentTransactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{formatCurrency(transaction.amount)}</p>
                        <p className="text-sm text-muted-foreground">{transaction.category} • {transaction.time}</p>
                      </div>
                      <div className="text-right">
                        {getTransactionStatusBadge(transaction.status)}
                        <p className="text-xs text-muted-foreground mt-1">{transaction.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="kiosks" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Kiosk Management</h3>
              <div className="space-y-4">
                {kiosks.map((kiosk) => (
                  <Card key={kiosk.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(kiosk.status)}
                        <div>
                          <h4 className="font-semibold">{kiosk.name}</h4>
                          <p className="text-sm text-muted-foreground">{kiosk.location}</p>
                          <p className="text-xs text-muted-foreground">Last sync: {kiosk.lastSync}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{formatCurrency(kiosk.todayTotal)}</p>
                          <p className="text-sm text-muted-foreground">Today's total</p>
                        </div>
                        {getStatusBadge(kiosk.status)}
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-4">
                      <Button size="sm" variant="outline">View Details</Button>
                      <Button size="sm" variant="outline">Remote Control</Button>
                      <Button size="sm" variant="outline">Restart</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Transaction History</h3>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">Filter</Button>
                  <Button size="sm" variant="outline">Export</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Transaction ID</th>
                      <th className="text-left p-2">Kiosk</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b">
                        <td className="p-2 font-mono text-sm">{transaction.id}</td>
                        <td className="p-2">{transaction.kiosk}</td>
                        <td className="p-2 font-semibold">{formatCurrency(transaction.amount)}</td>
                        <td className="p-2">{transaction.category}</td>
                        <td className="p-2 text-sm text-muted-foreground">{transaction.time}</td>
                        <td className="p-2">{getTransactionStatusBadge(transaction.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Donation Categories</h3>
                <Button size="sm">Add Category</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <Card key={category.id} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{category.name}</h4>
                        <p className="text-sm text-muted-foreground rtl">{category.nameArabic}</p>
                      </div>
                      <Badge variant={category.enabled ? "secondary" : "outline"}>
                        {category.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Today's donations:</span>
                        <span className="font-medium">{category.todayCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Today's amount:</span>
                        <span className="font-medium">{formatCurrency(category.todayAmount)}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-4">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">
                        {category.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Daily Trends</h3>
                <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Chart placeholder - Daily donation trends</p>
                </div>
              </Card>
              
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
                <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Chart placeholder - Category breakdown</p>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;