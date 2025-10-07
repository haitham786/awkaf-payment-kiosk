import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wifi, HardDrive, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KioskSetupPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kioskData, setKioskData] = useState<any>(null);
  
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [kioskForm, setKioskForm] = useState({
    name: "",
    location: "",
  });

  const [posConfig, setPosConfig] = useState({
    connectionType: "usb",
    ipAddress: "",
    port: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user has admin role
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);

        if (roles && roles.some(r => r.role === 'admin')) {
          setIsAuthenticated(true);
          await loadKioskData();
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKioskData = async () => {
    try {
      // Get kiosk ID from localStorage or device identifier
      const kioskId = localStorage.getItem('kiosk_id');
      if (kioskId) {
        const { data, error } = await supabase
          .from('kiosks')
          .select('*')
          .eq('id', kioskId)
          .single();

        if (error) throw error;
        setKioskData(data);
        setKioskForm({
          name: data.name || "",
          location: data.location || "",
        });
        
        // Load POS config from kiosk configuration
        if (data.configuration && typeof data.configuration === 'object' && 'pos' in data.configuration) {
          const config = data.configuration as any;
          if (config.pos) {
            setPosConfig(config.pos);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading kiosk data:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

      if (error) throw error;

      // Check if user has admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id);

      if (!roles || !roles.some(r => r.role === 'admin')) {
        await supabase.auth.signOut();
        throw new Error("Unauthorized: Admin access required");
      }

      setIsAuthenticated(true);
      await loadKioskData();
      toast({ title: "Logged in successfully" });
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRegisterKiosk = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Generate or get device identifier
      let kioskId = localStorage.getItem('kiosk_id');
      
      if (!kioskId) {
        // Create new kiosk registration
        const { data, error } = await supabase
          .from('kiosks')
          .insert([{
            name: kioskForm.name,
            location: kioskForm.location,
            status: 'inactive', // Pending approval
            configuration: { pos: posConfig }
          }])
          .select()
          .single();

        if (error) throw error;
        
        kioskId = data.id;
        localStorage.setItem('kiosk_id', kioskId);
        setKioskData(data);
        
        toast({
          title: "Registration request sent",
          description: "Waiting for admin approval from the web panel",
        });
      } else {
        // Update existing kiosk
        const { error } = await supabase
          .from('kiosks')
          .update({
            name: kioskForm.name,
            location: kioskForm.location,
            configuration: { pos: posConfig },
            last_heartbeat: new Date().toISOString()
          })
          .eq('id', kioskId);

        if (error) throw error;
        await loadKioskData();
        
        toast({ title: "Kiosk information updated" });
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTestPosConnection = () => {
    toast({
      title: "POS Connection Test",
      description: "Testing connection to Ingenico Axium RX5000...",
    });
    
    // TODO: Implement actual POS connection test
    // This will require the Ingenico SDK integration
    setTimeout(() => {
      toast({
        title: "POS Not Connected",
        description: "Please ensure the POS device is connected and the SDK is configured",
        variant: "destructive",
      });
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-xl text-primary">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <Settings className="w-16 h-16 mx-auto text-primary" />
            <h1 className="text-3xl font-bold">Kiosk Setup Panel</h1>
            <p className="text-muted-foreground">Administrator Access Required</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full">
              Login
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/kiosk')}
            >
              Back to Kiosk
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/kiosk')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Kiosk
          </Button>
          <h1 className="text-3xl font-bold">Kiosk Setup Panel</h1>
          <Button variant="outline" onClick={() => {
            supabase.auth.signOut();
            setIsAuthenticated(false);
          }}>
            Logout
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General Settings</TabsTrigger>
            <TabsTrigger value="pos">POS Configuration</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Kiosk Information</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="kiosk-name">Kiosk Name</Label>
                  <Input
                    id="kiosk-name"
                    value={kioskForm.name}
                    onChange={(e) => setKioskForm({ ...kioskForm, name: e.target.value })}
                    placeholder="e.g., Muscat Mall Kiosk"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={kioskForm.location}
                    onChange={(e) => setKioskForm({ ...kioskForm, location: e.target.value })}
                    placeholder="e.g., Muscat City Centre, Ground Floor"
                  />
                </div>

                {kioskData && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>Status:</strong> {kioskData.status}</p>
                    <p><strong>Reference Number:</strong> {kioskData.reference_number || 'Pending'}</p>
                  </div>
                )}

                <Button onClick={handleRegisterKiosk} className="w-full">
                  {kioskData ? 'Update Kiosk Information' : 'Register Kiosk'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="pos" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">POS Configuration</h2>
              <div className="space-y-4">
                <div>
                  <Label>Connection Type</Label>
                  <div className="flex gap-4 mt-2">
                    <Button
                      variant={posConfig.connectionType === 'usb' ? 'default' : 'outline'}
                      onClick={() => setPosConfig({ ...posConfig, connectionType: 'usb' })}
                    >
                      USB
                    </Button>
                    <Button
                      variant={posConfig.connectionType === 'ethernet' ? 'default' : 'outline'}
                      onClick={() => setPosConfig({ ...posConfig, connectionType: 'ethernet' })}
                    >
                      Ethernet
                    </Button>
                  </div>
                </div>

                {posConfig.connectionType === 'ethernet' && (
                  <>
                    <div>
                      <Label htmlFor="ip">IP Address</Label>
                      <Input
                        id="ip"
                        value={posConfig.ipAddress}
                        onChange={(e) => setPosConfig({ ...posConfig, ipAddress: e.target.value })}
                        placeholder="192.168.1.100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        value={posConfig.port}
                        onChange={(e) => setPosConfig({ ...posConfig, port: e.target.value })}
                        placeholder="8080"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-semibold">Device: Ingenico Axium RX5000</p>
                  <p className="text-xs text-muted-foreground">
                    Ensure the POS terminal is properly connected and powered on
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleTestPosConnection} className="flex-1">
                    <HardDrive className="w-4 h-4 mr-2" />
                    Test Connection
                  </Button>
                  <Button onClick={handleRegisterKiosk} variant="outline" className="flex-1">
                    Save Configuration
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Connection Status</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-semibold">Admin Panel Connection</p>
                      <p className="text-sm text-muted-foreground">
                        {kioskData?.status === 'active' ? 'Connected' : 'Pending Approval'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    kioskData?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5" />
                    <div>
                      <p className="font-semibold">POS Terminal</p>
                      <p className="text-sm text-muted-foreground">Not Connected</p>
                    </div>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </div>

                {kioskData?.status !== 'active' && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      This kiosk is pending approval from the admin panel. Please contact an administrator.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default KioskSetupPanel;
