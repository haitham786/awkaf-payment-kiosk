import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, MessageCircle, Save, Wallet } from "lucide-react";

interface Props {
  /** Transactions already filtered by the page's period / kiosk / category filters. */
  transactions: any[];
}

type Counts = { sent: number; failed: number; notSent: number };

const emptyCounts = (): Counts => ({ sent: 0, failed: 0, notSent: 0 });

const tally = (transactions: any[], field: "sms_status" | "whatsapp_status"): Counts => {
  const counts = emptyCounts();
  for (const t of transactions) {
    const status = t?.[field] || "not_sent";
    if (status === "sent") counts.sent += 1;
    else if (status === "failed") counts.failed += 1;
    else counts.notSent += 1;
  }
  return counts;
};

const omr = (value: number) => value.toFixed(3);

const ChannelBlock = ({
  label,
  icon,
  counts,
  unitCost,
}: {
  label: string;
  icon: React.ReactNode;
  counts: Counts;
  unitCost: number;
}) => (
  <div className="rounded-lg border p-4 space-y-3">
    <div className="flex items-center gap-2 font-semibold">
      {icon}
      {label}
    </div>
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-2xl font-bold text-green-600">{counts.sent}</p>
        <p className="text-xs text-muted-foreground">Sent</p>
      </div>
      <div>
        <p className="text-2xl font-bold text-destructive">{counts.failed}</p>
        <p className="text-xs text-muted-foreground">Failed</p>
      </div>
      <div>
        <p className="text-2xl font-bold text-muted-foreground">{counts.notSent}</p>
        <p className="text-xs text-muted-foreground">Not sent</p>
      </div>
    </div>
    <div className="pt-2 border-t flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">Estimated cost</span>
      <span className="font-semibold">{omr(counts.sent * unitCost)} OMR</span>
    </div>
  </div>
);

const ReceiptDeliveryCostCard = ({ transactions }: Props) => {
  const { toast } = useToast();
  const [rateId, setRateId] = useState<string | null>(null);
  const [smsRate, setSmsRate] = useState("0");
  const [waRate, setWaRate] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("messaging_rates")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        setRateId(data.id);
        setSmsRate(String(data.sms_unit_cost_omr ?? 0));
        setWaRate(String(data.whatsapp_unit_cost_omr ?? 0));
      }
    })();
  }, []);

  const smsUnit = Number(smsRate) || 0;
  const waUnit = Number(waRate) || 0;

  const smsCounts = useMemo(() => tally(transactions, "sms_status"), [transactions]);
  const waCounts = useMemo(() => tally(transactions, "whatsapp_status"), [transactions]);

  const smsCost = smsCounts.sent * smsUnit;
  const waCost = waCounts.sent * waUnit;
  const totalCost = smsCost + waCost;
  const totalSent = smsCounts.sent + waCounts.sent;

  const handleSaveRates = async () => {
    setSaving(true);
    try {
      const payload = {
        sms_unit_cost_omr: smsUnit,
        whatsapp_unit_cost_omr: waUnit,
      };
      if (rateId) {
        const { error } = await supabase.from("messaging_rates").update(payload).eq("id", rateId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("messaging_rates")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setRateId(data.id);
      }
      toast({ title: "Rates saved" });
    } catch (e: any) {
      toast({ title: "Error saving rates", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Receipt Delivery &amp; Cost</h2>
          <p className="text-sm text-muted-foreground">
            Based on the selected period, kiosk and category filters. Costs are estimates — the
            provider invoice is authoritative.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChannelBlock
          label="SMS"
          icon={<MessageSquare className="w-4 h-4" />}
          counts={smsCounts}
          unitCost={smsUnit}
        />
        <ChannelBlock
          label="WhatsApp (Twilio)"
          icon={<MessageCircle className="w-4 h-4" />}
          counts={waCounts}
          unitCost={waUnit}
        />
      </div>

      <div className="mt-4 rounded-lg border bg-muted/40 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {totalSent} receipt{totalSent === 1 ? "" : "s"} delivered
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Estimated total</p>
          <p className="text-2xl font-bold">{omr(totalCost)} OMR</p>
        </div>
      </div>

      {totalSent > 0 && (
        <div className="mt-4">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-primary"
              style={{ width: `${(smsCounts.sent / totalSent) * 100}%` }}
            />
            <div
              className="bg-green-500"
              style={{ width: `${(waCounts.sent / totalSent) * 100}%` }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" /> SMS {smsCounts.sent}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> WhatsApp{" "}
              {waCounts.sent}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t">
        <p className="text-sm font-medium mb-3">Unit rates (OMR per delivered message)</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="sms_rate" className="text-xs">
              SMS
            </Label>
            <Input
              id="sms_rate"
              type="number"
              step="0.001"
              min="0"
              className="w-32"
              value={smsRate}
              onChange={(e) => setSmsRate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa_rate" className="text-xs">
              WhatsApp
            </Label>
            <Input
              id="wa_rate"
              type="number"
              step="0.001"
              min="0"
              className="w-32"
              value={waRate}
              onChange={(e) => setWaRate(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveRates} disabled={saving} variant="outline">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save rates"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Update these when your SMS gateway or Twilio/Meta WhatsApp pricing changes.
        </p>
      </div>
    </Card>
  );
};

export default ReceiptDeliveryCostCard;
