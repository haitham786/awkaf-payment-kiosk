import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Save, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const SMSSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testMobile, setTestMobile] = useState('');

  const [settings, setSettings] = useState({
    id: '',
    api_endpoint: '',
    api_key: '',
    api_username: '',
    api_password: '',
    sender_id: '',
  });

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          api_endpoint: data.api_endpoint || '',
          api_key: data.api_key || '',
          api_username: data.api_username || '',
          api_password: data.api_password || '',
          sender_id: data.sender_id || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading SMS settings:', error);
      toast({
        title: "Error loading settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      if (settings.id) {
        // Update existing settings
        const { error } = await supabase
          .from('sms_settings')
          .update({
            api_endpoint: settings.api_endpoint,
            api_key: settings.api_key,
            api_username: settings.api_username,
            api_password: settings.api_password,
            sender_id: settings.sender_id,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new settings
        const { data, error } = await supabase
          .from('sms_settings')
          .insert({
            api_endpoint: settings.api_endpoint,
            api_key: settings.api_key,
            api_username: settings.api_username,
            api_password: settings.api_password,
            sender_id: settings.sender_id,
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      toast({
        title: "Settings saved",
        description: "SMS gateway settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMS = async () => {
    const digits = testMobile.replace(/\D/g, '');
    if (digits.length < 8) {
      toast({
        title: "Invalid mobile number",
        description: "Enter an 8-digit Omani mobile number (or full international number).",
        variant: "destructive",
      });
      return;
    }
    const fullNumber = digits.length === 8 ? `968${digits}` : digits;

    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          mobile_number: fullNumber,
          category: 'test',
          reference_number: 'TEST' + Date.now().toString().slice(-9),
          amount_baisas: 10000
        }
      });

      if (error) throw error;

      const detail = data?.return_code
        ? `Return code ${data.return_code}: ${data.error || data.message}`
        : (data?.error || data?.message || 'No response from gateway');

      toast({
        title: data?.success ? "Test SMS sent" : "Test SMS failed",
        description: detail,
        variant: data?.success ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold">SMS Gateway Settings</h1>
          </div>
          <ThemeToggle />
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">Omantel iSmart SMS (Infocomm) gateway</p>
                <p className="text-muted-foreground">
                  Uses HTTP POST to <code className="text-xs">SMSDynamicRefIntlAPI.aspx</code>. Provide the User ID,
                  Password, and registered Sender Header issued by Infocomm.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_endpoint">API URL</Label>
                <Input
                  id="api_endpoint"
                  type="url"
                  placeholder="https://www.ismartsms.net/iBulkSMS/HttpWS/SMSDynamicRefIntlAPI.aspx"
                  value={settings.api_endpoint}
                  onChange={(e) => setSettings(prev => ({ ...prev, api_endpoint: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the default Infocomm endpoint.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api_username">User ID (UserId)</Label>
                  <Input
                    id="api_username"
                    type="text"
                    placeholder="Provided by Infocomm"
                    value={settings.api_username}
                    onChange={(e) => setSettings(prev => ({ ...prev, api_username: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_password">Password</Label>
                  <div className="relative">
                    <Input
                      id="api_password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Provided by Infocomm"
                      value={settings.api_password}
                      onChange={(e) => setSettings(prev => ({ ...prev, api_password: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_id">Sender Header</Label>
                <Input
                  id="sender_id"
                  type="text"
                  maxLength={11}
                  placeholder="e.g. Awkaf"
                  value={settings.sender_id}
                  onChange={(e) => setSettings(prev => ({ ...prev, sender_id: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Max 11 characters. Must be a header registered with Infocomm, otherwise the gateway returns code 19.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test_mobile">Test Mobile Number</Label>
                <div className="flex gap-3 items-start">
                  <div className="relative flex-1 max-w-xs">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+968</div>
                    <Input
                      id="test_mobile"
                      type="tel"
                      inputMode="numeric"
                      placeholder="9XXXXXXX"
                      value={testMobile}
                      onChange={(e) => setTestMobile(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="pl-14"
                      maxLength={12}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestSMS}
                    disabled={testing || testMobile.replace(/\D/g, '').length < 8 || (!settings.api_username && !settings.api_endpoint)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {testing ? 'Testing...' : 'Send Test SMS'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter an 8-digit Omani mobile number. The test SMS will be sent to this number.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">SMS Features</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>SMS will be sent automatically after successful transactions</li>
              <li>Only transactions with mobile numbers will receive SMS</li>
              <li>Duplicate SMS prevention for the same transaction</li>
              <li>Full audit trail of SMS delivery status</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Message Format</h3>
            <p className="text-sm text-muted-foreground">
              SMS receipts include: donation amount, date/time, system reference number, and POS/Bank reference when available.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SMSSettings;
