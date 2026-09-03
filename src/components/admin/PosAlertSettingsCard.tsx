import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BellRing } from "lucide-react";

interface AlertSettings {
  id?: string;
  enabled: boolean;
  recipients: string[];
  offline_threshold_seconds: number;
  alert_on_attention: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
}

const DEFAULTS: AlertSettings = {
  enabled: true,
  recipients: [],
  offline_threshold_seconds: 180,
  alert_on_attention: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

/** Admin control for POS outage / recovery alerts (recipients, threshold, quiet hours). */
export const PosAlertSettingsCard = () => {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULTS);
  const [recipientsText, setRecipientsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("pos_alert_settings").select("*").limit(1).maybeSingle();
      if (data) {
        const next = { ...DEFAULTS, ...(data as any), recipients: (data as any).recipients ?? [] };
        setSettings(next);
        setRecipientsText((next.recipients || []).join(", "));
      }
    };
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const recipients = recipientsText
        .split(/[,\n]/)
        .map((r) => r.trim())
        .filter(Boolean);
      const payload = {
        enabled: settings.enabled,
        recipients,
        offline_threshold_seconds: settings.offline_threshold_seconds,
        alert_on_attention: settings.alert_on_attention,
        quiet_hours_start: settings.quiet_hours_start,
        quiet_hours_end: settings.quiet_hours_end,
        updated_at: new Date().toISOString(),
      };
      const { error } = settings.id
        ? await supabase.from("pos_alert_settings").update(payload).eq("id", settings.id)
        : await supabase.from("pos_alert_settings").insert(payload);
      if (error) throw error;
      setSettings((s) => ({ ...s, recipients }));
      toast.success("POS alert settings saved");
    } catch (err: any) {
      toast.error(err?.message || "Could not save alert settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-bold">POS Health Alerts</h3>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))} />
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Alert recipients (mobile numbers, comma separated)</Label>
          <Input
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            placeholder="96891234567, 96897654321"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            One SMS per outage (Offline / Not responding / Needs attention) and one when the terminal is back to Ready.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Offline after (seconds)</Label>
            <Input
              type="number"
              min={60}
              value={settings.offline_threshold_seconds}
              onChange={(e) => setSettings((s) => ({ ...s, offline_threshold_seconds: Number(e.target.value) || 180 }))}
            />
          </div>
          <div>
            <Label className="text-xs">Quiet hours from (0-23)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={settings.quiet_hours_start ?? ""}
              onChange={(e) =>
                setSettings((s) => ({ ...s, quiet_hours_start: e.target.value === "" ? null : Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label className="text-xs">Quiet hours to (0-23)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={settings.quiet_hours_end ?? ""}
              onChange={(e) =>
                setSettings((s) => ({ ...s, quiet_hours_end: e.target.value === "" ? null : Number(e.target.value) }))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-2">
          <span className="text-xs">Also alert on “Needs attention” (paper / battery)</span>
          <Switch
            checked={settings.alert_on_attention}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, alert_on_attention: v }))}
          />
        </div>

        <Button onClick={save} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save alert settings"}
        </Button>
      </div>
    </Card>
  );
};

export default PosAlertSettingsCard;
