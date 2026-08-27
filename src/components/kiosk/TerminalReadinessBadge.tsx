import { useEffect, useState } from "react";
import { Loader2, Wifi, Clock } from "lucide-react";
import { subscribeTerminalReadiness, type TerminalReadiness } from "@/lib/hardwarePosWarm";
import { getCachedPaymentMode } from "@/lib/kioskConfig";

/**
 * Live terminal readiness for the idle screens. Tells the donor (and the
 * attendant) whether the payment terminal is ready before an amount is chosen,
 * instead of surfacing a terminal problem only after confirmation.
 */
export const TerminalReadinessBadge = () => {
  const [status, setStatus] = useState<TerminalReadiness>("unknown");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      const kioskId = localStorage.getItem("kiosk_id");
      setEnabled(!!kioskId && getCachedPaymentMode(kioskId) === "hardware_pos");
    } catch {
      setEnabled(false);
    }
    return subscribeTerminalReadiness((snapshot) => setStatus(snapshot.status));
  }, []);

  if (!enabled || status === "unknown") return null;

  const config = {
    ready: {
      icon: Wifi,
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      ar: "جهاز الدفع جاهز",
      en: "Terminal ready",
      spin: false,
    },
    reconnecting: {
      icon: Loader2,
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      ar: "جارٍ إعادة الاتصال بجهاز الدفع",
      en: "Reconnecting to terminal",
      spin: true,
    },
    busy: {
      icon: Clock,
      className: "bg-muted text-muted-foreground",
      ar: "جهاز الدفع مشغول",
      en: "Terminal busy",
      spin: false,
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.65rem] backdrop-blur-sm ${config.className}`}
      role="status"
    >
      <Icon className={`w-3 h-3 ${config.spin ? "animate-spin" : ""}`} aria-hidden="true" />
      <span className="font-semibold">{config.ar}</span>
      <span className="opacity-70">{config.en}</span>
    </div>
  );
};
