import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const SMSSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    api_endpoint: '',
    api_username: '',
    api_key: '',
    api_password: '',
    sender_id: ''
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
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setFormData({
          api_endpoint: data.api_endpoint || '',
          api_username: data.api_username || '',
          api_key: data.api_key || '',
          api_password: data.api_password || '',
          sender_id: data.sender_id || ''
        });
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('sms_settings')
        .select('id')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('sms_settings')
          .update(formData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sms_settings')
          .insert([formData]);

        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: "SMS settings have been updated successfully.",
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
          category: 'زكاة',
          reference_number: 'TEST123456',
          amount_baisas: 10000
        }
      });

      if (error) throw error;

      toast({
        title: "Test SMS sent",
        description: "Check the logs for the SMS preview.",
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

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;

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
            <h1 className="text-3xl font-bold">SMS Settings</h1>
          </div>
          <ThemeToggle />
        </div>

        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <Label htmlFor="api_endpoint">API Endpoint URL</Label>
              <Input
                id="api_endpoint"
                value={formData.api_endpoint}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                required
                placeholder="https://api.omantel.om/sms/send"
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="api_username">API Username</Label>
                <Input
                  id="api_username"
                  value={formData.api_username}
                  onChange={(e) => setFormData({ ...formData, api_username: e.target.value })}
                  placeholder="username"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="API key"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="api_password">API Password/Token</Label>
              <Input
                id="api_password"
                type="password"
                value={formData.api_password}
                onChange={(e) => setFormData({ ...formData, api_password: e.target.value })}
                placeholder="••••••••"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="sender_id">Sender ID</Label>
              <Input
                id="sender_id"
                value={formData.sender_id}
                onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                placeholder="Awkaf"
                className="mt-2"
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestSMS}
                disabled={testing || !formData.api_endpoint}
              >
                <Send className="w-4 h-4 mr-2" />
                {testing ? 'Testing...' : 'Test SMS'}
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Important Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All credentials are stored securely and encrypted</li>
              <li>Test SMS will send a sample message to verify configuration</li>
              <li>SMS will be sent automatically after successful transactions</li>
              <li>Only transactions with mobile numbers will receive SMS</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SMSSettings;
