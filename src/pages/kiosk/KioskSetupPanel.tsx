import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Settings, Eye, EyeOff, Loader2, Info, LogOut, RefreshCw, Cloud, Cable, CheckCircle2, AlertTriangle, HelpCircle, Unplug, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScreenSize } from "@/hooks/useScreenSize";
import { loadKioskRuntimeConfig } from "@/lib/kioskConfig";
import { useNboPosHealth } from "@/hooks/useNboPosHealth";
import { lastSeenLabel, omanTimestamp, POS_HEALTH_META, readerLabel, type PosHealthState } from "@/lib/posHealth";


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

  const storedKioskId = typeof window !== 'undefined' ? localStorage.getItem('kiosk_id') : null;
  const { snapshot: posHealth, checking: posHealthChecking, refresh: refreshPosHealth } = useNboPosHealth(storedKioskId, isAuthenticated);

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
            <Button type="submit" variant="outline" className="h-10 w-full border-kiosk-border bg-transparent font-semibold text-kiosk-text hover:bg-kiosk-page">Login</Button>
            <Button type="button" variant="outline" className="h-10 w-full border-kiosk-border bg-transparent font-semibold text-kiosk-text hover:bg-kiosk-page" onClick={() => navigate('/kiosk')}>Back to Kiosk</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4" style={{ fontSize: `${scaleFactor}rem` }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/kiosk')} className="h-9 w-9 shrink-0 text-kiosk-text hover:bg-kiosk-page" aria-label="Back to kiosk">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="mr-auto text-xl font-bold text-kiosk-text sm:text-2xl">Kiosk Setup Panel</h1>
          <Button variant="ghost" onClick={() => { supabase.auth.signOut(); setIsAuthenticated(false); }} className="h-9 shrink-0 gap-2 text-kiosk-text hover:bg-kiosk-page">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
           <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-kiosk-page p-1">
             <TabsTrigger value="general" className="rounded-lg text-sm text-kiosk-muted data-[state=active]:bg-kiosk-surface data-[state=active]:text-kiosk-text data-[state=active]:shadow-sm">General</TabsTrigger>
             <TabsTrigger value="status" className="rounded-lg text-sm text-kiosk-muted data-[state=active]:bg-kiosk-surface data-[state=active]:text-kiosk-text data-[state=active]:shadow-sm">POS Status</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Kiosk Information</h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="kiosk-name" className="text-gray-900 text-sm">Kiosk Name</Label>
                  <Input id="kiosk-name" value={kioskForm.name} onChange={(e) => setKioskForm({ ...kioskForm, name: e.target.value })} placeholder="e.g., Muscat Mall Kiosk" className="bg-white text-gray-900 border-gray-300 h-9 focus-visible:ring-0 focus-visible:ring-offset-0" />
                </div>
                <div>
                  <Label htmlFor="location" className="text-gray-900 text-sm">Location</Label>
                  <Input id="location" value={kioskForm.location} onChange={(e) => setKioskForm({ ...kioskForm, location: e.target.value })} placeholder="e.g., Ground Floor" className="bg-white text-gray-900 border-gray-300 h-9 focus-visible:ring-0 focus-visible:ring-offset-0" />
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

          <TabsContent value="status" className="space-y-3">
            {(() => {
              const state = posHealth.state as PosHealthState;
              const meta = POS_HEALTH_META[state] ?? POS_HEALTH_META.unknown;
              const StateIcon = state === "ready" ? CheckCircle2 : state === "attention" ? AlertTriangle : state === "offline" ? Unplug : state === "not_responding" ? HelpCircle : Clock;
              const stateAccent = state === "ready" ? "border-l-kiosk-ready bg-kiosk-ready-soft/40" : state === "attention" ? "border-l-kiosk-attention bg-kiosk-attention-soft/40" : state === "unknown" ? "border-l-kiosk-muted bg-kiosk-page" : "border-l-kiosk-offline bg-kiosk-offline-soft/40";
              const stateText = state === "ready" ? "text-kiosk-ready-text" : state === "attention" ? "text-kiosk-attention-text" : state === "unknown" ? "text-kiosk-muted" : "text-kiosk-offline-text";
              const adminConnected = kioskData?.status === "active";
              const usbConnected = posHealth.transportConnected;
              const reader = readerLabel(posHealth.readerStatus) ?? "idle";
              const chip = (ok: boolean | null | undefined) => ok === true ? "border-kiosk-ready/30 bg-kiosk-ready-soft text-kiosk-ready-text" : ok === false ? "border-kiosk-attention/30 bg-kiosk-attention-soft text-kiosk-attention-text" : "border-kiosk-border bg-kiosk-page text-kiosk-muted";
              const connectionPill = (connected: boolean) => connected ? "border-kiosk-ready/30 bg-kiosk-ready-soft text-kiosk-ready-text" : "border-kiosk-offline/30 bg-kiosk-offline-soft text-kiosk-offline-text";
              return (
                <>
                  <Card className="rounded-2xl border-kiosk-border bg-kiosk-surface p-4 shadow-kiosk">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-kiosk-text">POS Health &amp; Status</h2>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5 border-kiosk-brand/15 bg-kiosk-brand-soft px-3 text-xs font-semibold text-kiosk-brand hover:bg-kiosk-brand-soft/70" onClick={() => refreshPosHealth()} disabled={posHealthChecking}>
                        {posHealthChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Ping / Test
                      </Button>
                    </div>

                    <div className={`rounded-xl border border-l-4 border-kiosk-border p-3.5 ${stateAccent}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stateText} ${state === "ready" ? "bg-kiosk-ready-soft" : state === "attention" ? "bg-kiosk-attention-soft" : state === "unknown" ? "bg-kiosk-page" : "bg-kiosk-offline-soft"}`}>
                            <StateIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-sm font-semibold text-kiosk-text">OM-A880 Terminal</h3>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${stateText} ${state === "ready" ? "bg-kiosk-ready-soft" : state === "attention" ? "bg-kiosk-attention-soft" : state === "unknown" ? "bg-kiosk-page" : "bg-kiosk-offline-soft"}`}>{meta.label}</span>
                            </div>
                            <p className="mt-1 text-[10px] font-normal leading-4 text-kiosk-muted">{posHealth.message || "Awaiting terminal status"}{posHealth.responded ? " · USB connected · responding" : ""}</p>
                          </div>
                        </div>
                        <div className="min-w-[112px] shrink-0 text-right text-kiosk-muted">
                          <p className="whitespace-nowrap text-[10px] font-semibold"><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${state === "ready" ? "bg-kiosk-ready" : state === "attention" ? "bg-kiosk-attention" : "bg-kiosk-offline"}`} />{lastSeenLabel(posHealth.checkedAt)}</p>
                          <p className="mt-0.5 whitespace-nowrap text-[8px] font-normal">{omanTimestamp(posHealth.checkedAt)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${chip(posHealth.paperOk)}`}>Paper {posHealth.paperOk === false ? "Low / Empty" : posHealth.paperOk === true ? "OK" : "Unknown"}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${chip(posHealth.batteryOk)}`}>Battery {posHealth.batteryOk === false ? "Low" : posHealth.batteryOk === true ? "OK" : "Unknown"}</span>
                        <span className="rounded-full border border-kiosk-border bg-kiosk-page px-2.5 py-1 text-[9px] font-semibold text-kiosk-muted">Reader {reader}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 border-t border-kiosk-border pt-1 text-[9px]">
                        {[["TID", posHealth.tid], ["Serial", posHealth.serialNumber], ["Firmware", posHealth.firmwareVersion], ["App", posHealth.appVersion ?? "kiosk-web"]].map(([label, value]) => (
                          <div key={label} className="flex min-w-0 justify-between gap-2 border-b border-kiosk-border py-2 odd:pr-3 even:pl-3">
                            <span className="text-kiosk-muted">{label}</span><span className="truncate font-semibold text-kiosk-text">{value || "—"}</span>
                          </div>
                        ))}
                        <div className="col-span-2 flex justify-between gap-3 py-2">
                          <span className="shrink-0 text-kiosk-muted">USB</span><span className="break-all text-right font-semibold text-kiosk-text">{posHealth.connectionInfo || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-start gap-1.5 px-1 text-[9px] font-normal leading-4 text-kiosk-muted">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      <p>Checks USB transport, terminal heartbeat (GetStatus 114) and housekeeping (paper / battery) every 20 seconds while idle.</p>
                    </div>
                  </Card>

                  <Card className="rounded-2xl border-kiosk-border bg-kiosk-surface p-4 shadow-kiosk">
                    <h2 className="mb-3 text-base font-semibold text-kiosk-text">Connection Status</h2>
                    <div className="divide-y divide-kiosk-border overflow-hidden rounded-xl border border-kiosk-border">
                      {[
                        { label: "Admin Panel", sublabel: adminConnected ? "Cloud backend · syncing status & heartbeats" : "Awaiting activation by administrator", connected: adminConnected, Icon: Cloud },
                        { label: "Terminal (USB)", sublabel: posHealth.connectionInfo ? `OM-A880 · ${posHealth.connectionInfo}` : "OM-A880 · USB device not detected", connected: usbConnected, Icon: Cable },
                      ].map(({ label, sublabel, connected, Icon }) => (
                        <div key={label} className="flex items-center gap-3 bg-kiosk-surface p-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${connected ? "bg-kiosk-ready-soft text-kiosk-ready-text" : "bg-kiosk-offline-soft text-kiosk-offline-text"}`}><Icon className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-kiosk-text">{label}</p><p className="truncate text-[9px] font-normal text-kiosk-muted">{sublabel}</p></div>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold ${connectionPill(connected)}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-kiosk-ready" : "bg-kiosk-offline"}`} />{connected ? "Connected" : "Disconnected"}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default KioskSetupPanel;
