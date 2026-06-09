import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Settings, Eye, EyeOff, Smartphone, CheckCircle, XCircle, Loader2, Info, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScreenSize } from "@/hooks/useScreenSize";
import { checkNFCAvailability, initializeSoftPOS, getSoftPOSStatus, SoftPosMode } from "@/services/softPosService";
import { loadKioskRuntimeConfig } from "@/lib/kioskConfig";

const KioskSetupPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scaleFactor } = useScreenSize();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kioskData, setKioskData] = useState<any>(null);
  
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [kioskForm, setKioskForm] = useState({ name: "", location: "" });

  const [softPosConfig, setSoftPosConfig] = useState({
    authKey: "",
    isProduction: false,
    mode: "test" as SoftPosMode,
  });
  
  const [softPosNfcStatus, setSoftPosNfcStatus] = useState<{
    isAvailable: boolean; isEnabled: boolean; checking: boolean; tested: boolean;
  }>({ isAvailable: false, isEnabled: false, checking: false, tested: false });
  
  const [kioskPaymentMode, setKioskPaymentMode] = useState<'soft_pos' | 'payment_gateway' | 'test_payment'>('soft_pos');

  useEffect(() => { checkAuth(); }, []);

  const loadKioskConfig = async () => {
    const kioskId = localStorage.getItem('kiosk_id');
    if (!kioskId) return;
    try {
      const config = await loadKioskRuntimeConfig(kioskId, { includeSoftPosSecret: true });
      applyKioskConfig(config);
    } catch (error) { console.error('Error loading kiosk config:', error); }
  };

  const applyKioskConfig = (configRaw: unknown) => {
    const config = configRaw as Record<string, unknown> | null | undefined;
    if (!config) return;
    setKioskPaymentMode((config.payment_mode as 'soft_pos' | 'payment_gateway' | 'test_payment') || 'soft_pos');
    if (config.soft_pos && typeof config.soft_pos === 'object') {
      const sp = config.soft_pos as { auth_key?: string; is_production?: boolean; mode?: string };
      setSoftPosConfig(prev => ({ authKey: sp.auth_key ?? prev.authKey, isProduction: sp.is_production ?? false, mode: (sp.mode as SoftPosMode) || 'test' }));
    }
  };

  useEffect(() => {
    const kioskId = localStorage.getItem('kiosk_id');
    if (!kioskId) return;
    const channel = supabase.channel('kiosk-config-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kiosks', filter: `id=eq.${kioskId}` },
        (payload) => {
          applyKioskConfig((payload.new as any)?.configuration);
          toast({ title: 'Configuration Updated', description: 'Settings synced from admin panel.' });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [toast]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id);
        if (roles && roles.some(r => r.role === 'admin')) {
          setIsAuthenticated(true);
          await loadKioskData();
        }
      }
    } catch (error) { console.error('Auth check error:', error); }
    finally { setLoading(false); }
  };

  const loadKioskData = async () => {
    try {
      const kioskId = localStorage.getItem('kiosk_id');
      if (kioskId) {
        const { data, error } = await supabase.from('kiosks').select('*').eq('id', kioskId).single();
        if (error) throw error;
        setKioskData(data);
        setKioskForm({ name: data.name || "", location: data.location || "" });
        await loadKioskConfig();
      }
    } catch (error: any) { console.error('Error loading kiosk data:', error); }
  };
  
  const handleTestSoftPosNfc = async () => {
    setSoftPosNfcStatus(prev => ({ ...prev, checking: true }));
    toast({ title: "Testing NFC", description: "Checking NFC availability..." });
    try {
      await initializeSoftPOS({ authKey: softPosConfig.authKey || 'TEST_AUTH_KEY', isProduction: softPosConfig.isProduction, mode: softPosConfig.mode });
      const nfcStatus = await checkNFCAvailability();
      setSoftPosNfcStatus({ isAvailable: nfcStatus.isAvailable, isEnabled: nfcStatus.isEnabled, checking: false, tested: true });
      const status = getSoftPOSStatus();
      if (nfcStatus.isAvailable && nfcStatus.isEnabled) {
        toast({ title: "NFC Ready", description: `Thawani Lamsa Soft POS ready. Mode: ${status.mode === 'test' ? 'Test' : 'Live'}` });
      } else {
        toast({ title: "NFC Not Available", description: "Running in simulation mode.", variant: "destructive" });
      }
    } catch (error: any) {
      setSoftPosNfcStatus(prev => ({ ...prev, checking: false }));
      toast({ title: "NFC Test Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginForm.email, password: loginForm.password });
      if (error) throw error;
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
      if (!roles || !roles.some(r => r.role === 'admin')) { await supabase.auth.signOut(); throw new Error("Unauthorized: Admin access required"); }
      setIsAuthenticated(true);
      await loadKioskData();
      toast({ title: "Logged in successfully" });
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
  };

  const handleRegisterKiosk = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      let kioskId = localStorage.getItem('kiosk_id');
      if (!kioskId) {
        const { data, error } = await supabase.from('kiosks').insert([{
          name: kioskForm.name, location: kioskForm.location, status: 'pending_approval',
          configuration: { payment_mode: 'soft_pos', sound_enabled: true },
        }]).select().single();
        if (error) throw error;
        kioskId = data.id;
        localStorage.setItem('kiosk_id', kioskId);
        setKioskData(data);
        toast({ title: "Registration request sent", description: "Waiting for admin approval" });
      } else {
        const { data: existing } = await supabase.from('kiosks').select('configuration').eq('id', kioskId).single();
        const existingConfig = existing?.configuration && typeof existing.configuration === 'object' ? (existing.configuration as any) : {};
        const mergedConfig = { ...existingConfig };
        const { error } = await supabase.from('kiosks').update({
          name: kioskForm.name, location: kioskForm.location,
          configuration: mergedConfig, last_heartbeat: new Date().toISOString(),
        }).eq('id', kioskId);
        if (error) throw error;
        await loadKioskData();
        toast({ title: "Kiosk information updated" });
      }
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
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
      <div className="min-h-screen flex items-center justify-center bg-white p-4" style={{ fontSize: `${scaleFactor}rem` }}>
        <Card className="w-full max-w-md p-6 space-y-4 bg-white border-gray-200">
          <div className="text-center space-y-2">
            <Settings className="w-12 h-12 mx-auto text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Kiosk Setup Panel</h1>
            <p className="text-sm text-gray-600">Administrator Access Required</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-gray-900 text-sm">Email</Label>
              <Input id="email" type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required placeholder="admin@example.com" className="bg-gray-100 text-gray-900 border-0 h-10 focus-visible:ring-0 focus-visible:ring-offset-0" />
            </div>
            <div>
              <Label htmlFor="password" className="text-gray-900 text-sm">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required placeholder="••••••••" className="bg-gray-100 text-gray-900 border-0 h-10 pr-10 focus-visible:ring-0 focus-visible:ring-offset-0" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-600" /> : <Eye className="h-4 w-4 text-gray-600" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full h-10">Login</Button>
            <Button type="button" variant="outline" className="w-full h-10" onClick={() => navigate('/kiosk')}>Back to Kiosk</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4" style={{ fontSize: `${scaleFactor}rem` }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate('/kiosk')} className="text-gray-900 hover:bg-gray-100 h-9">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Kiosk
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kiosk Setup Panel</h1>
          <Button variant="outline" onClick={() => { supabase.auth.signOut(); setIsAuthenticated(false); }} className="h-9">Logout</Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 h-10">
            <TabsTrigger value="general" className="text-sm text-gray-900 data-[state=active]:bg-white">General</TabsTrigger>
            <TabsTrigger value="payment" className="text-sm text-gray-900 data-[state=active]:bg-white">Payment</TabsTrigger>
            <TabsTrigger value="status" className="text-sm text-gray-900 data-[state=active]:bg-white">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Kiosk Information</h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="kiosk-name" className="text-gray-900 text-sm">Kiosk Name</Label>
                  <Input id="kiosk-name" value={kioskForm.name} onChange={(e) => setKioskForm({ ...kioskForm, name: e.target.value })} placeholder="e.g., Muscat Mall Kiosk" className="bg-white text-gray-900 border-gray-300 h-9" />
                </div>
                <div>
                  <Label htmlFor="location" className="text-gray-900 text-sm">Location</Label>
                  <Input id="location" value={kioskForm.location} onChange={(e) => setKioskForm({ ...kioskForm, location: e.target.value })} placeholder="e.g., Ground Floor" className="bg-white text-gray-900 border-gray-300 h-9" />
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

          {/* Payment Configuration Tab */}
          <TabsContent value="payment" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Payment Configuration</h2>
              <p className="text-xs text-gray-600 mb-3">Payment method is managed from admin panel under "Manage KIOSK".</p>
              
              <div className="space-y-3">
                {/* Current Payment Mode */}
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  kioskPaymentMode === 'soft_pos' ? 'bg-emerald-50 border border-emerald-200' :
                  kioskPaymentMode === 'payment_gateway' ? 'bg-blue-50 border border-blue-200' :
                  kioskPaymentMode === 'test_payment' ? 'bg-amber-50 border border-amber-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  {kioskPaymentMode === 'soft_pos' ? (
                    <><Smartphone className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-700">Soft POS Active - Thawani Lamsa NFC</span></>
                  ) : kioskPaymentMode === 'test_payment' ? (
                    <><Info className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium text-amber-700">Testing Mode Active - Simulated Successful Payments</span></>
                  ) : (
                    <><Globe className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium text-blue-700">Payment Gateway Active - Thawani Checkout</span></>
                  )}
                </div>

                {kioskPaymentMode === 'soft_pos' && (
                  <>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Smartphone className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-blue-900">
                            Mode: {softPosConfig.mode === 'test' ? 'Test / Simulation' : 'Live (Production)'}
                          </p>
                          <p className="text-[10px] text-blue-700 mt-1">
                            {softPosConfig.mode === 'test' ? 'Payments are simulated for testing.' : 'Thawani Lamsa SDK active. Real card transactions.'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-gray-900 text-sm">Environment</Label>
                        <Input value={softPosConfig.isProduction ? 'Production' : 'Staging'} className="bg-gray-50 text-gray-700 border-gray-300 h-9" readOnly />
                      </div>
                      <div>
                        <Label className="text-gray-900 text-sm">Auth Key</Label>
                        <Input value={softPosConfig.authKey ? '••••••••' : 'Not configured'} className="bg-gray-50 text-gray-700 border-gray-300 h-9" readOnly />
                      </div>
                    </div>

                    {/* NFC Status */}
                    <div className={`p-3 rounded-lg flex items-center gap-2 ${
                      softPosNfcStatus.tested
                        ? softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}>
                      {softPosNfcStatus.checking ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> :
                       softPosNfcStatus.tested ? (softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-600" />) :
                       <div className="w-4 h-4 rounded-full bg-gray-400" />}
                      <span className={`text-sm font-medium ${
                        softPosNfcStatus.tested ? (softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled ? 'text-emerald-700' : 'text-red-700') : 'text-gray-700'
                      }`}>
                        {softPosNfcStatus.checking ? 'Checking NFC...' :
                         softPosNfcStatus.tested ? (softPosNfcStatus.isAvailable && softPosNfcStatus.isEnabled ? 'NFC Ready' : 'NFC Not Available') :
                         'NFC Status Unknown'}
                      </span>
                    </div>

                    <Button onClick={handleTestSoftPosNfc} className="w-full h-9 text-sm" disabled={softPosNfcStatus.checking}>
                      {softPosNfcStatus.checking ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Smartphone className="w-3 h-3 mr-1" />}
                      {softPosNfcStatus.checking ? 'Testing...' : 'Test NFC / Soft POS'}
                    </Button>
                  </>
                )}

                {kioskPaymentMode === 'payment_gateway' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Globe className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-900">Thawani Payment Gateway</p>
                        <p className="text-[10px] text-blue-700 mt-1">
                          Donors will be redirected to Thawani's secure checkout page to enter card details.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {kioskPaymentMode === 'test_payment' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900">Standalone Testing Mode</p>
                        <p className="text-[10px] text-amber-700 mt-1">
                          Donations are recorded as successful transactions without launching Thawani services.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Connection Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-gray-700" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Admin Panel</p>
                      <p className="text-xs text-gray-600">{kioskData?.status === 'active' ? 'Connected' : 'Pending'}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${kioskData?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                </div>

                {kioskData?.status !== 'active' && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700">This kiosk is pending approval. Please contact an administrator.</p>
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
