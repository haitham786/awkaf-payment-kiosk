import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNboPosHealth } from "@/hooks/useNboPosHealth";

/**
 * App-level heartbeat for the OM-A880 terminal.
 *
 * Previously the health loop only ran while an attendant had the kiosk Setup
 * Panel open on the "POS Status" tab, so the admin panel only ever saw a
 * heartbeat during those few minutes. This daemon runs for the whole lifetime
 * of the kiosk app instead — it is mounted once, next to the router.
 *
 * It stays paused on admin/auth screens, during an active payment (the ECR
 * link must never be probed mid-transaction) and while the Setup Panel is open
 * (that screen runs its own loop, so we avoid two pollers on one serial port).
 */

const PAYMENT_PATHS = [
  "/kiosk/nbo-pos",
  "/kiosk/hardware-pos",
  "/kiosk/payment-request",
  "/kiosk/test-payment",
];

function readKioskId(): string | null {
  try {
    return localStorage.getItem("kiosk_id");
  } catch {
    return null;
  }
}

export const PosHealthDaemon: React.FC = () => {
  const location = useLocation();
  const [kioskId, setKioskId] = useState<string | null>(() => readKioskId());

  // The kiosk id only appears after registration/approval, and it can be
  // cleared from the setup panel — poll cheaply so the loop starts (or stops)
  // without needing an app restart.
  useEffect(() => {
    const sync = () => setKioskId((current) => {
      const next = readKioskId();
      return next === current ? current : next;
    });
    sync();
    const interval = window.setInterval(sync, 5000);
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", sync);
    };
  }, [location.pathname]);

  const path = location.pathname;
  const isKioskApp = !path.startsWith("/admin") && !path.startsWith("/auth");
  const isSetupPanel = path.startsWith("/kiosk/setup");
  const isPaying = PAYMENT_PATHS.some((p) => path.startsWith(p));
  const enabled = Boolean(kioskId) && isKioskApp && !isSetupPanel && !isPaying;

  useNboPosHealth(kioskId, enabled);

  return null;
};

export default PosHealthDaemon;
