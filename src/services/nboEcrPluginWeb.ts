import { WebPlugin } from "@capacitor/core";
import type { NboEcrPluginInterface, NboPurchaseOptions, NboPurchaseResult } from "./nboEcrPlugin";

/**
 * Browser fallback for the NBO OM-A880 USB bridge.
 *
 * A browser cannot open a USB serial port, so this simulator lets the donation
 * flow be reviewed in the Lovable preview. It never reports a real payment: the
 * result is clearly flagged as simulated and is only approved in the preview.
 */
export class NboEcrPluginWeb extends WebPlugin implements NboEcrPluginInterface {
  private cancelled = false;

  async isAvailable() {
    return { available: false, deviceAttached: false, connectionInfo: null, error: "USB serial is only available in the Android kiosk app" };
  }

  async listDevices() {
    return { devices: [] };
  }

  async purchase(options: NboPurchaseOptions): Promise<NboPurchaseResult> {
    this.cancelled = false;
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (this.cancelled) {
      return { approved: false, completed: false, cancelled: true, responseText: "Cancelled" };
    }

    return {
      approved: true,
      completed: true,
      responseCode: "00",
      responseText: "APPROVED (SIMULATED)",
      rrn: `SIM${Date.now()}`,
      authCode: "SIMAUT",
      invoiceNumber: options.transactionId.slice(0, 6),
      cardType: "Simulator",
      cardLastFour: "4242",
      raw: null,
    };
  }

  async cancel() {
    this.cancelled = true;
    return { cancelled: true };
  }

  async getTerminalInfo() {
    return {
      responded: false,
      error: "USB serial is only available in the Android kiosk app",
    };
  }

  async getStatus() {
    // No USB in the browser: report the terminal as unreachable (Offline).
    return {
      responded: false,
      deviceAttached: false,
      error: "USB serial is only available in the Android kiosk app",
    };
  }
}

