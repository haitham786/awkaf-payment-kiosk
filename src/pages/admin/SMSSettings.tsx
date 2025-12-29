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
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          mobile_number: '96899999999',
          category: 'zakat',
          reference_number: 'TEST123456789',
          amount_baisas: 10000
        }
      });

      if (error) throw error;

      toast({
        title: "Test SMS sent",
        description: data.message || "Check the logs for the SMS preview.",
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
              <div className="space-y-2">
                <Label htmlFor="api_endpoint">API Endpoint URL</Label>
                <Input
                  id="api_endpoint"
                  type="url"
                  placeholder="https://api.smsgateway.com/send"
                  value={settings.api_endpoint}
                  onChange={(e) => setSettings(prev => ({ ...prev, api_endpoint: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  The full URL of the SMS gateway API endpoint
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api_key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your API key"
                    value={settings.api_key}
                    onChange={(e) => setSettings(prev => ({ ...prev, api_key: e.target.value }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Authentication key for the SMS gateway
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api_username">API Username (Optional)</Label>
                  <Input
                    id="api_username"
                    type="text"
                    placeholder="Username"
                    value={settings.api_username}
                    onChange={(e) => setSettings(prev => ({ ...prev, api_username: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_password">API Password (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="api_password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
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
                <Label htmlFor="sender_id">Sender ID</Label>
                <Input
                  id="sender_id"
                  type="text"
                  placeholder="e.g., Awkaf"
                  value={settings.sender_id}
                  onChange={(e) => setSettings(prev => ({ ...prev, sender_id: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  The sender name that will appear on SMS messages (max 11 characters)
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestSMS}
                disabled={testing || !settings.api_endpoint}
              >
                <Send className="w-4 h-4 mr-2" />
                {testing ? 'Testing...' : 'Send Test SMS'}
              </Button>
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
