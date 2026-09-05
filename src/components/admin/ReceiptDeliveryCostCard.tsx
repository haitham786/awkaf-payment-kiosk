import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { MessageSquare, MessageCircle } from "lucide-react";

type Counts = { sent: number; failed: number; notSent: number };

interface Props {
  /** Aggregated in the database for the page's period / kiosk / category filters. */
  smsCounts: Counts;
  whatsappCounts: Counts;
}

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
  <div className="rounded-lg border p-4 space-y-3 bg-background">
    <div className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {label}
    </div>
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-lg font-bold text-success">{counts.sent}</p>
        <p className="text-[10px] uppercase text-muted-foreground">Sent</p>
      </div>
      <div>
        <p className="text-lg font-bold text-destructive">{counts.failed}</p>
        <p className="text-[10px] uppercase text-muted-foreground">Failed</p>
      </div>
      <div>
        <p className="text-lg font-bold text-muted-foreground">{counts.notSent}</p>
        <p className="text-[10px] uppercase text-muted-foreground">Not sent</p>
      </div>
    </div>
    <div className="pt-2 border-t flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">Estimated cost</span>
      <span className="font-semibold">{omr(counts.sent * unitCost)} OMR</span>
    </div>
  </div>
);

const ReceiptDeliveryCostCard = ({ smsCounts, whatsappCounts: waCounts }: Props) => {
  const [smsRate, setSmsRate] = useState("0");
  const [waRate, setWaRate] = useState("0");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("messaging_rates")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        setSmsRate(String(data.sms_unit_cost_omr ?? 0));
        setWaRate(String(data.whatsapp_unit_cost_omr ?? 0));
      }
    })();
  }, []);

  const smsUnit = Number(smsRate) || 0;
  const waUnit = Number(waRate) || 0;


  const smsCost = smsCounts.sent * smsUnit;
  const waCost = waCounts.sent * waUnit;
  const totalCost = smsCost + waCost;
  const totalSent = smsCounts.sent + waCounts.sent;

  return (
    <Card className="mt-3 p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-bold">Receipt Delivery &amp; Cost</h2>
        <p className="text-xs text-muted-foreground">respects the current filters · estimates only — the provider invoice is authoritative</p>
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

      <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
        <span>{totalSent} receipt{totalSent === 1 ? "" : "s"} delivered · SMS vs WhatsApp mix</span>
        <span className="text-lg">{omr(totalCost)} OMR</span>
      </div>
    </Card>
  );
};

export default ReceiptDeliveryCostCard;
