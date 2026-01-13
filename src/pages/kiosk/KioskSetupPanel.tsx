import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wifi, HardDrive, Settings, Eye, EyeOff, Smartphone, CheckCircle, XCircle, Loader2, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScreenSize } from "@/hooks/useScreenSize";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { testConnection, ConnectionStatus, getConnectionStatus, onConnectionStatusChange, initializePOS } from "@/services/hardPosService";
import { checkNFCAvailability, initializeSoftPOS, getSoftPOSStatus, SoftPosMode, AmwalEnvironment } from "@/services/softPosService";

const KioskSetupPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scaleFactor, profile } = useScreenSize();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kioskData, setKioskData] = useState<any>(null);
  
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const [kioskForm, setKioskForm] = useState({
    name: "",
    location: "",
  });

  const [posConfig, setPosConfig] = useState({
    connectionType: "usb" as "usb" | "ethernet",
    ipAddress: "",
    port: "",
  });
  
  const [posConnectionStatus, setPosConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const [softPosConfig, setSoftPosConfig] = useState({
    merchantId: "",
    terminalId: "",
    sessionToken: "",
    environment: "SIT" as AmwalEnvironment,
    mode: "mock" as SoftPosMode,
    locale: "ar" as 'ar' | 'en',
    transactionType: "NFC" as 'NFC' | 'CARD_WALLET' | 'GOOGLE_PAY',
  });
  
  const [softPosNfcStatus, setSoftPosNfcStatus] = useState<{
    isAvailable: boolean;
    isEnabled: boolean;
    checking: boolean;
    tested: boolean;
  }>({
    isAvailable: false,
    isEnabled: false,
    checking: false,
    tested: false,
  });
  
  const [kioskPaymentMode, setKioskPaymentMode] = useState<'hardware_pos' | 'soft_pos'>('hardware_pos');

  useEffect(() => {
    checkAuth();
  }, []);

  // Load Soft POS config from kiosk's own configuration (synced from admin panel)
  const loadKioskSoftPosConfig = async () => {
    const kioskId = localStorage.getItem('kiosk_id');
    if (!kioskId) return;

    try {
      const { data, error } = await supabase
        .from('kiosks')
        .select('configuration')
        .eq('id', kioskId)
        .single();

      if (error) throw error;

      applyKioskConfig(data?.configuration);
    } catch (error) {
      console.error('Error loading kiosk Soft POS settings:', error);
    }
  };

  // Helper to apply config to state
  const applyKioskConfig = (configRaw: unknown) => {
    const config = configRaw as Record<string, unknown> | null | undefined;
    if (!config) return;

    // Set payment mode
    setKioskPaymentMode((config.payment_mode as 'hardware_pos' | 'soft_pos') || 'hardware_pos');

    // Set POS config if available
    if (config.pos && typeof config.pos === 'object') {
      const posConf = config.pos as { connectionType?: string; ipAddress?: string; port?: string };
      setPosConfig({
        connectionType: (posConf.connectionType as 'usb' | 'ethernet') || 'usb',
        ipAddress: posConf.ipAddress || '',
        port: posConf.port || '',
      });
    }

    // Set Soft POS config if available (Amwal Pay)
    if (config.soft_pos && typeof config.soft_pos === 'object') {
      const sp = config.soft_pos as { 
        merchant_id?: string; 
        terminal_id?: string; 
        session_token?: string;
        environment?: string; 
        mode?: string;
        locale?: string;
        transaction_type?: string;
      };
      setSoftPosConfig({
        merchantId: sp.merchant_id || '',
        terminalId: sp.terminal_id || '',
        sessionToken: sp.session_token || '',
        environment: (sp.environment as AmwalEnvironment) || 'SIT',
        mode: (sp.mode as SoftPosMode) || 'mock',
        locale: (sp.locale as 'ar' | 'en') || 'ar',
        transactionType: (sp.transaction_type as 'NFC' | 'CARD_WALLET' | 'GOOGLE_PAY') || 'NFC',
      });
    }
  };

  // Subscribe to realtime config updates from admin panel
  useEffect(() => {
    const kioskId = localStorage.getItem('kiosk_id');
    if (!kioskId) return;

    const channel = supabase
      .channel('kiosk-config-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kiosks',
          filter: `id=eq.${kioskId}`,
        },
        (payload) => {
          console.log('[KioskSetup] Received realtime config update:', payload);
          applyKioskConfig((payload.new as any)?.configuration);
          toast({
            title: 'Configuration Updated',
            description: 'Settings synced from admin panel.',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

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
        
        // Also load Soft POS config from kiosk configuration
        await loadKioskSoftPosConfig();
      }
    } catch (error: any) {
      console.error('Error loading kiosk data:', error);
    }
  };
  
  const handleTestSoftPosNfc = async () => {
    setSoftPosNfcStatus(prev => ({ ...prev, checking: true }));
    
    toast({
      title: "Testing NFC",
      description: "Checking NFC availability for Soft POS...",
    });
    
    try {
      // Initialize Soft POS service with current config (Amwal Pay)
      await initializeSoftPOS({
        merchantId: softPosConfig.merchantId || '',
        terminalId: softPosConfig.terminalId || '',
        sessionToken: softPosConfig.sessionToken || '',
        environment: softPosConfig.environment,
        mode: softPosConfig.mode,
        locale: softPosConfig.locale,
        transactionType: softPosConfig.transactionType,
      });
      
      // Check NFC status
      const nfcStatus = await checkNFCAvailability();
      
      setSoftPosNfcStatus({
        isAvailable: nfcStatus.isAvailable,
        isEnabled: nfcStatus.isEnabled,
        checking: false,
        tested: true,
      });
      
      const status = getSoftPOSStatus();
      
      if (nfcStatus.isAvailable && nfcStatus.isEnabled) {
        toast({
          title: "NFC Ready",
          description: `Soft POS is ready for contactless payments. Mode: ${status.mode === 'mock' ? 'Trial/Simulation' : 'Live'}`,
        });
      } else if (!nfcStatus.isAvailable) {
        toast({
          title: "NFC Not Available",
          description: "This device does not have NFC hardware. Soft POS will run in simulation mode.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "NFC Disabled",
          description: "Please enable NFC in device settings to accept contactless payments.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setSoftPosNfcStatus(prev => ({ ...prev, checking: false }));
      toast({
        title: "NFC Test Failed",
        description: error.message,
        variant: "destructive",
      });
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
          .insert([
            {
              name: kioskForm.name,
              location: kioskForm.location,
              status: 'pending_approval', // Pending approval
              // IMPORTANT: do not set payment_mode here; admin controls it in "Manage KIOSK"
              configuration: {
                payment_mode: 'hardware_pos',
                pos: posConfig,
                sound_enabled: true,
              },
            },
          ])
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
        // IMPORTANT: Merge config so we NEVER overwrite admin-set payment_mode/soft_pos
        const { data: existing, error: existingError } = await supabase
          .from('kiosks')
          .select('configuration')
          .eq('id', kioskId)
          .single();

        if (existingError) throw existingError;

        const existingConfig =
          existing?.configuration && typeof existing.configuration === 'object'
            ? (existing.configuration as any)
            : {};

        const mergedConfig = {
          ...existingConfig,
          pos: posConfig,
        };

        const { error } = await supabase
          .from('kiosks')
          .update({
            name: kioskForm.name,
            location: kioskForm.location,
            configuration: mergedConfig,
            last_heartbeat: new Date().toISOString(),
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

  const handleTestPosConnection = async () => {
    setIsTestingConnection(true);
    toast({
      title: "POS Connection Test",
      description: `Testing ${posConfig.connectionType.toUpperCase()} connection...`,
    });
    
    try {
      const result = await testConnection({
        connectionType: posConfig.connectionType,
        ipAddress: posConfig.ipAddress,
        port: posConfig.port,
      });
      
      setPosConnectionStatus(result.connected ? 'connected' : 'disconnected');
      
      toast({
        title: result.connected ? "Connection Successful" : "Connection Failed",
        description: result.message,
        variant: result.connected ? "default" : "destructive",
      });
      
      // If connected, initialize the POS for use
      if (result.connected) {
        await initializePOS({
          connectionType: posConfig.connectionType,
          ipAddress: posConfig.ipAddress,
          port: posConfig.port,
        });
      }
    } catch (error: any) {
      setPosConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: error.message || "Failed to test POS connection",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-xl text-gray-800">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-white p-4"
        style={{ fontSize: `${scaleFactor}rem` }}
      >
        <Card className="w-full max-w-md p-6 space-y-4 bg-white border-gray-200">
          <div className="text-center space-y-2">
            <Settings className="w-12 h-12 mx-auto text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Kiosk Setup Panel</h1>
            <p className="text-sm text-gray-600">Administrator Access Required</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-gray-900 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
                placeholder="admin@example.com"
                className="bg-white text-gray-900 border-gray-300 h-10"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-900 text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                  placeholder="••••••••"
                  className="bg-white text-gray-900 border-gray-300 h-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-600" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full h-10">
              Login
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full h-10"
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
    <div 
      className="min-h-screen bg-white p-4"
      style={{ fontSize: `${scaleFactor}rem` }}
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/kiosk')} 
            className="text-gray-900 hover:bg-gray-100 h-9"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Kiosk
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kiosk Setup Panel</h1>
          <Button 
            variant="outline" 
            onClick={() => {
              supabase.auth.signOut();
              setIsAuthenticated(false);
            }}
            className="h-9"
          >
            Logout
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 h-10">
            <TabsTrigger value="general" className="text-sm text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900">General</TabsTrigger>
            <TabsTrigger value="hard-pos" className="text-sm text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900">Hard POS</TabsTrigger>
            <TabsTrigger value="soft-pos" className="text-sm text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900">Soft POS</TabsTrigger>
            <TabsTrigger value="status" className="text-sm text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Kiosk Information</h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="kiosk-name" className="text-gray-900 text-sm">Kiosk Name</Label>
                  <Input
                    id="kiosk-name"
                    value={kioskForm.name}
                    onChange={(e) => setKioskForm({ ...kioskForm, name: e.target.value })}
                    placeholder="e.g., Muscat Mall Kiosk"
                    className="bg-white text-gray-900 border-gray-300 h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="location" className="text-gray-900 text-sm">Location</Label>
                  <Input
                    id="location"
                    value={kioskForm.location}
                    onChange={(e) => setKioskForm({ ...kioskForm, location: e.target.value })}
                    placeholder="e.g., Muscat City Centre, Ground Floor"
                    className="bg-white text-gray-900 border-gray-300 h-9"
                  />
                </div>

                {kioskData && (
                  <div className="space-y-1 text-xs text-gray-600 p-2 bg-gray-50 rounded">
                    <p><strong>Status:</strong> {kioskData.status}</p>
                    <p><strong>Reference Number:</strong> {kioskData.reference_number || 'Pending'}</p>
                  </div>
                )}

                <Button onClick={handleRegisterKiosk} className="w-full h-10">
                  {kioskData ? 'Update Kiosk Information' : 'Register Kiosk'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Hard POS Tab */}
          <TabsContent value="hard-pos" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Hard POS Configuration</h2>
              <p className="text-xs text-gray-600 mb-3">Configure USB or Ethernet POS terminal connection for this kiosk.</p>
              <div className="space-y-3">
                {/* Connection Status Display */}
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  posConnectionStatus === 'connected' 
                    ? 'bg-emerald-50 border border-emerald-200' 
                    : posConnectionStatus === 'error'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  {posConnectionStatus === 'connected' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : posConnectionStatus === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-gray-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    posConnectionStatus === 'connected' 
                      ? 'text-emerald-700' 
                      : posConnectionStatus === 'error'
                      ? 'text-red-700'
                      : 'text-gray-700'
                  }`}>
                    {posConnectionStatus === 'connected' 
                      ? 'Connected' 
                      : posConnectionStatus === 'error'
                      ? 'Connection Error'
                      : posConnectionStatus === 'connecting'
                      ? 'Connecting...'
                      : 'Not Connected'}
                  </span>
                </div>

                <div>
                  <Label className="text-gray-900 text-sm">Connection Type</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={posConfig.connectionType === 'usb' ? 'default' : 'outline'}
                      onClick={() => {
                        setPosConfig({ ...posConfig, connectionType: 'usb' });
                        setPosConnectionStatus('disconnected');
                      }}
                      className="flex-1 h-9 text-sm"
                    >
                      <HardDrive className="w-3 h-3 mr-1" />
                      USB
                    </Button>
                    <Button
                      variant={posConfig.connectionType === 'ethernet' ? 'default' : 'outline'}
                      onClick={() => {
                        setPosConfig({ ...posConfig, connectionType: 'ethernet' });
                        setPosConnectionStatus('disconnected');
                      }}
                      className="flex-1 h-9 text-sm"
                    >
                      <Wifi className="w-3 h-3 mr-1" />
                      Ethernet
                    </Button>
                  </div>
                </div>

                {posConfig.connectionType === 'usb' && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900">USB Auto-Detection</p>
                    <p className="text-[10px] text-blue-700 mt-1">
                      POS device will be automatically detected when connected via USB. No manual configuration required.
                    </p>
                  </div>
                )}

                {posConfig.connectionType === 'ethernet' && (
                  <>
                    <div>
                      <Label htmlFor="ip" className="text-gray-900 text-sm">IP Address</Label>
                      <Input
                        id="ip"
                        value={posConfig.ipAddress}
                        onChange={(e) => setPosConfig({ ...posConfig, ipAddress: e.target.value })}
                        placeholder="192.168.1.100"
                        className="bg-white text-gray-900 border-gray-300 h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="port" className="text-gray-900 text-sm">Port</Label>
                      <Input
                        id="port"
                        value={posConfig.port}
                        onChange={(e) => setPosConfig({ ...posConfig, port: e.target.value })}
                        placeholder="8080"
                        className="bg-white text-gray-900 border-gray-300 h-9"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-900">POS-Agnostic Design</p>
                  <p className="text-[10px] text-gray-600">
                    Compatible with Verifone, Ingenico, PAX, and other POS terminals. No vendor-specific SDK required.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleTestPosConnection} 
                    className="flex-1 h-9 text-sm"
                    disabled={isTestingConnection || (posConfig.connectionType === 'ethernet' && (!posConfig.ipAddress || !posConfig.port))}
                  >
                    {isTestingConnection ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <HardDrive className="w-3 h-3 mr-1" />
                    )}
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button onClick={handleRegisterKiosk} variant="outline" className="flex-1 h-9 text-sm">
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Soft POS Tab */}
          <TabsContent value="soft-pos" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Soft POS Configuration (Thawani)</h2>
              <p className="text-xs text-gray-600 mb-3">NFC contactless payment settings. Managed from admin panel under "Manage KIOSK".</p>
              
              <div className="space-y-3">
                {/* Current Payment Mode */}
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  kioskPaymentMode === 'soft_pos' 
                    ? 'bg-emerald-50 border border-emerald-200' 
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  {kioskPaymentMode === 'soft_pos' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    kioskPaymentMode === 'soft_pos' ? 'text-emerald-700' : 'text-gray-600'
                  }`}>
                    {kioskPaymentMode === 'soft_pos' 
                      ? 'Soft POS Active - Thawani NFC Payments' 
                      : 'Hardware POS Active - Soft POS Disabled'}
                  </span>
                </div>
                
                {kioskPaymentMode !== 'soft_pos' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        This kiosk is configured for Hardware POS. To enable Soft POS, change the payment mode in the admin panel under "Manage KIOSK".
                      </p>
                    </div>
                  </div>
                )}

                {kioskPaymentMode === 'soft_pos' && (
                  <>
                    {/* Mode Display */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Smartphone className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-blue-900">
                            Mode: {softPosConfig.mode === 'mock' ? 'Trial / Simulation' : 'Live (Production)'}
                          </p>
                          <p className="text-[10px] text-blue-700 mt-1">
                            {softPosConfig.mode === 'mock' 
                              ? 'Payments are simulated for testing. Card taps will generate mock transactions.'
                              : 'Live Thawani SDK active. Real card transactions.'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Environment */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-gray-900 text-sm">Environment</Label>
                        <Input
                          value={softPosConfig.environment}
                          className="bg-gray-50 text-gray-700 border-gray-300 h-9"
                          readOnly
                        />
                      </div>
                      <div>
                        <Label className="text-gray-900 text-sm">Merchant ID</Label>
                        <Input
                          value={softPosConfig.merchantId ? '••••••••' : 'Not configured'}
                          className="bg-gray-50 text-gray-700 border-gray-300 h-9"
                          readOnly
                        />
                      </div>
                    </div>

                    {/* NFC Status */}
                    <div className={`p-3 rounded-lg flex items-center gap-2 ${
                      softPosNfcStatus.tested
                        ? softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled
                          ? 'bg-emerald-50 border border-emerald-200' 
                          : 'bg-red-50 border border-red-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}>
                      {softPosNfcStatus.checking ? (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      ) : softPosNfcStatus.tested ? (
                        softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-400" />
                      )}
                      <span className={`text-sm font-medium ${
                        softPosNfcStatus.tested
                          ? softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled
                            ? 'text-emerald-700' 
                            : 'text-red-700'
                          : 'text-gray-700'
                      }`}>
                        {softPosNfcStatus.checking 
                          ? 'Checking NFC...' 
                          : softPosNfcStatus.tested 
                            ? softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled
                              ? 'NFC Ready for Payments'
                              : softPosNfcStatus.isAvailable 
                                ? 'NFC Disabled - Enable in Settings'
                                : 'NFC Not Available (Simulation Mode)'
                            : 'NFC Status Unknown'}
                      </span>
                    </div>

                    <div className="space-y-1 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-[10px] text-blue-700">
                        <strong>Compatible Devices:</strong> Samsung A33, Sunmi Flex 3, and other NFC-enabled Android devices.
                        In trial mode, payments are simulated even without physical NFC hardware.
                      </p>
                    </div>
                  </>
                )}

                <Button 
                  onClick={handleTestSoftPosNfc} 
                  className="w-full h-9 text-sm"
                  disabled={softPosNfcStatus.checking || kioskPaymentMode !== 'soft_pos'}
                >
                  {softPosNfcStatus.checking ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Smartphone className="w-3 h-3 mr-1" />
                  )}
                  {softPosNfcStatus.checking ? 'Testing...' : 'Test NFC / Soft POS'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Connection Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-gray-700" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Admin Panel</p>
                      <p className="text-xs text-gray-600">
                        {kioskData?.status === 'active' ? 'Connected' : 'Pending'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    kioskData?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-gray-700" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">POS Terminal</p>
                      <p className="text-xs text-gray-600">Not Connected</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>

                {kioskData?.status !== 'active' && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700">
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
