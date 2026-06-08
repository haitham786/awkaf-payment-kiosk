import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Save, MessageCircle } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const WhatsAppSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMobile, setTestMobile] = useState('');

  const [settings, setSettings] = useState({
    id: '',
    from_number: '',
    template_sid: '',
    template_language: 'ar',
    is_enabled: false,
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/auth'); return; }
      await loadSettings();
    })();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSettings({
          id: data.id,
          from_number: data.from_number || '',
          template_sid: data.template_sid || '',
          template_language: data.template_language || 'ar',
          is_enabled: !!data.is_enabled,
        });
      }
    } catch (e: any) {
      toast({ title: "Error loading settings", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        from_number: settings.from_number.trim(),
        template_sid: settings.template_sid.trim(),
        template_language: settings.template_language.trim() || 'ar',
        is_enabled: settings.is_enabled,
      };
      if (settings.id) {
        const { error } = await supabase.from('whatsapp_settings').update(payload).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('whatsapp_settings').insert(payload).select().single();
        if (error) throw error;
        if (data) setSettings(prev => ({ ...prev, id: data.id }));
      }
      toast({ title: "Settings saved", description: "WhatsApp settings have been updated." });
    } catch (e: any) {
      toast({ title: "Error saving settings", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const digits = testMobile.replace(/\D/g, '');
    if (digits.length < 8) {
      toast({ title: "Invalid mobile number", description: "Enter an 8-digit Omani mobile number.", variant: "destructive" });
      return;
    }
    const fullNumber = digits.length === 8 ? `968${digits}` : digits;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          mobile_number: fullNumber,
          category: 'test',
          reference_number: 'TEST' + Date.now().toString().slice(-9),
          amount_baisas: 10000,
        },
      });
      if (error) throw error;
      toast({
        title: data?.success ? "Test WhatsApp sent" : "Test WhatsApp failed",
        description: data?.error || data?.message || 'No response',
        variant: data?.success ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
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
            <Button variant="outline" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MessageCircle className="w-7 h-7" /> WhatsApp Settings
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-semibold">Twilio WhatsApp Business</p>
              <p className="text-muted-foreground">
                Requires (1) a WhatsApp sender activated in Twilio (Sandbox for testing, an approved Business number for production), and (2) an approved WhatsApp message template in Arabic. Free-form messages outside the 24h session are rejected by WhatsApp.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-base">Enable WhatsApp delivery</Label>
                <p className="text-xs text-muted-foreground">When enabled, kiosks set to WhatsApp or Both will deliver receipts here.</p>
              </div>
              <Switch checked={settings.is_enabled} onCheckedChange={(v) => setSettings(p => ({ ...p, is_enabled: v }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="from_number">From Number (WhatsApp sender)</Label>
              <Input
                id="from_number"
                placeholder="whatsapp:+14155238886"
                value={settings.from_number}
                onChange={(e) => setSettings(p => ({ ...p, from_number: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Use the full Twilio WhatsApp identifier including the <code>whatsapp:</code> prefix and country code.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template_sid">Approved Template SID (ContentSid)</Label>
                <Input
                  id="template_sid"
                  placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={settings.template_sid}
                  onChange={(e) => setSettings(p => ({ ...p, template_sid: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Variables expected in order: 1 category, 2 amount, 3 date/time, 4 reference, 5 bank reference.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template_language">Template Language</Label>
                <Input
                  id="template_language"
                  placeholder="ar"
                  value={settings.template_language}
                  onChange={(e) => setSettings(p => ({ ...p, template_language: e.target.value }))}
                />
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
                    onClick={handleTest}
                    disabled={testing || testMobile.replace(/\D/g, '').length < 8 || !settings.from_number}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {testing ? 'Testing...' : 'Send Test WhatsApp'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: the test creates a synthetic reference and will fail at the transaction-verification step. Use a real completed transaction's reference to test the full path.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppSettings;
