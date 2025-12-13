import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wifi, HardDrive, Settings, Eye, EyeOff, Smartphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScreenSize } from "@/hooks/useScreenSize";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const [posType, setPosType] = useState<'hard_pos' | 'soft_pos'>('hard_pos');
  
  const [posConfig, setPosConfig] = useState({
    connectionType: "usb",
    ipAddress: "",
    port: "",
  });

  const [softPosConfig, setSoftPosConfig] = useState({
    merchantId: "",
    terminalId: "",
    apiKey: "",
    sdkEndpoint: "",
    callbackUrl: "",
    providerName: "",
  });

  useEffect(() => {
    checkAuth();
    loadGlobalPosSettings();
  }, []);

  const loadGlobalPosSettings = async () => {
    try {
      const { data } = await supabase
        .from('kiosk_settings')
        .select('pos_type, soft_pos_config')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setPosType((data.pos_type as 'hard_pos' | 'soft_pos') || 'hard_pos');
        if (data.soft_pos_config) {
          const config = data.soft_pos_config as any;
          setSoftPosConfig({
            merchantId: config.merchant_id || '',
            terminalId: config.terminal_id || '',
            apiKey: config.api_key || '',
            sdkEndpoint: config.sdk_endpoint || '',
            callbackUrl: config.callback_url || '',
            providerName: config.provider_name || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading global POS settings:', error);
    }
  };

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
            status: 'pending_approval', // Pending approval
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
      description: `Testing ${posConfig.connectionType.toUpperCase()} connection...`,
    });
    
    // TODO: Implement actual POS connection test
    // This will work with any POS device that provides SDK integration
    setTimeout(() => {
      toast({
        title: "POS Not Connected",
        description: "Please ensure the POS device is connected and properly configured",
        variant: "destructive",
      });
    }, 2000);
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
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 h-10">
            <TabsTrigger value="general" className="text-sm text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900">General</TabsTrigger>
            <TabsTrigger value="pos" className="text-sm text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900">POS Config</TabsTrigger>
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

          <TabsContent value="pos" className="space-y-3">
            <Card className="p-4 bg-white border-gray-200">
              <h2 className="text-lg font-bold mb-3 text-gray-900">POS Configuration</h2>
              <div className="space-y-3">
                {/* POS Type Selection */}
                <div>
                  <Label className="text-gray-900 text-sm">Payment Terminal Type</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        posType === 'hard_pos'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setPosType('hard_pos')}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          posType === 'hard_pos' ? 'bg-primary text-white' : 'bg-gray-100'
                        }`}>
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-xs text-gray-900">Hard POS</p>
                          <p className="text-[10px] text-gray-600">USB/Ethernet</p>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        posType === 'soft_pos'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setPosType('soft_pos')}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          posType === 'soft_pos' ? 'bg-primary text-white' : 'bg-gray-100'
                        }`}>
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-xs text-gray-900">Soft POS</p>
                          <p className="text-[10px] text-gray-600">NFC Contactless</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hard POS Configuration */}
                {posType === 'hard_pos' && (
                  <>
                    <div>
                      <Label className="text-gray-900 text-sm">Connection Type</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={posConfig.connectionType === 'usb' ? 'default' : 'outline'}
                          onClick={() => setPosConfig({ ...posConfig, connectionType: 'usb' })}
                          className="flex-1 h-9 text-sm"
                        >
                          USB
                        </Button>
                        <Button
                          variant={posConfig.connectionType === 'ethernet' ? 'default' : 'outline'}
                          onClick={() => setPosConfig({ ...posConfig, connectionType: 'ethernet' })}
                          className="flex-1 h-9 text-sm"
                        >
                          Ethernet
                        </Button>
                      </div>
                    </div>

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
                      <p className="text-xs font-semibold text-gray-900">Compatible with all POS devices</p>
                      <p className="text-[10px] text-gray-600">
                        Supports any POS terminal (Verifone, Ingenico, or Generic) with USB or Ethernet connectivity
                      </p>
                    </div>
                  </>
                )}

                {/* Soft POS Configuration */}
                {posType === 'soft_pos' && (
                  <>
                    <div>
                      <Label className="text-gray-900 text-sm">Provider</Label>
                      <Select
                        value={softPosConfig.providerName}
                        onValueChange={(value) => setSoftPosConfig({ ...softPosConfig, providerName: value })}
                      >
                        <SelectTrigger className="bg-white text-gray-900 border-gray-300 h-9">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_muscat">Bank Muscat</SelectItem>
                          <SelectItem value="thawani">Thawani</SelectItem>
                          <SelectItem value="oman_arab_bank">Oman Arab Bank</SelectItem>
                          <SelectItem value="ahli_bank">Ahli Bank</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-gray-900 text-sm">Merchant ID</Label>
                        <Input
                          value={softPosConfig.merchantId}
                          onChange={(e) => setSoftPosConfig({ ...softPosConfig, merchantId: e.target.value })}
                          placeholder="MID"
                          className="bg-white text-gray-900 border-gray-300 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-900 text-sm">Terminal ID</Label>
                        <Input
                          value={softPosConfig.terminalId}
                          onChange={(e) => setSoftPosConfig({ ...softPosConfig, terminalId: e.target.value })}
                          placeholder="TID"
                          className="bg-white text-gray-900 border-gray-300 h-9"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-900 text-sm">API Key / Secret Token</Label>
                      <Input
                        type="password"
                        value={softPosConfig.apiKey}
                        onChange={(e) => setSoftPosConfig({ ...softPosConfig, apiKey: e.target.value })}
                        placeholder="Enter API Key"
                        className="bg-white text-gray-900 border-gray-300 h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-gray-900 text-sm">SDK Endpoint URL</Label>
                      <Input
                        value={softPosConfig.sdkEndpoint}
                        onChange={(e) => setSoftPosConfig({ ...softPosConfig, sdkEndpoint: e.target.value })}
                        placeholder="https://api.provider.com/v1"
                        className="bg-white text-gray-900 border-gray-300 h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-gray-900 text-sm">Callback URL</Label>
                      <Input
                        value={softPosConfig.callbackUrl}
                        onChange={(e) => setSoftPosConfig({ ...softPosConfig, callbackUrl: e.target.value })}
                        placeholder="https://your-domain.com/callback"
                        className="bg-white text-gray-900 border-gray-300 h-9"
                      />
                    </div>

                    <div className="space-y-1 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-[10px] text-blue-700">
                        <strong>Sunmi Flex 3 Ready:</strong> Supports NFC contactless payments via SoftPOS SDK. 
                        Card data is handled securely by the SDK.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleTestPosConnection} className="flex-1 h-9 text-sm">
                    {posType === 'hard_pos' ? <HardDrive className="w-3 h-3 mr-1" /> : <Smartphone className="w-3 h-3 mr-1" />}
                    Test
                  </Button>
                  <Button onClick={handleRegisterKiosk} variant="outline" className="flex-1 h-9 text-sm">
                    Save
                  </Button>
                </div>
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
