/**
 * NBO OM-A880 ECR Plugin (Capacitor bridge)
 *
 * Bridges the kiosk web app to the native Android USB-serial ECR driver that
 * talks to the National Bank of Oman OM-A880 EFT-POS terminal, following the
 * "ECR / EFT POS Direct Integration Specification v1.22" framing:
 *
 *   ECR -> POS : STX <xml> ETX LRC
 *   POS -> ECR : ACK, intermediate messages, then the final response frame
 *
 * All serial I/O happens natively (Android USB Host). On the web the plugin
 * falls back to a simulator so the flow can be exercised in the preview.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NboPurchaseOptions {
  /** Amount in baisas (OMR minor units, 1 OMR = 1000). */
  amountBaisas: number;
  /** ECR reference for this attempt (used as the invoice / ECR ref). */
  transactionId: string;
  /** Serial baud rate — 115200 for the OM-A880. */
  baudRate?: number;
  /** Optional USB filters. When omitted the first CDC device is used. */
  vendorId?: number;
  productId?: number;
  /** Seconds to wait for the terminal's final response. */
  timeoutSeconds?: number;
}

export interface NboPurchaseResult {
  /** True only when the terminal returned an approved transaction. */
  approved: boolean;
  /** True when the command reached the terminal and a response was parsed. */
  completed: boolean;
  /** Set when the donor / kiosk cancelled the request. */
  cancelled?: boolean;
  responseCode?: string | null;
  responseText?: string | null;
  rrn?: string | null;
  authCode?: string | null;
  invoiceNumber?: string | null;
  cardType?: string | null;
  cardLastFour?: string | null;
  tid?: string | null;
  mid?: string | null;
  /** Raw XML returned by the terminal (kept for reconciliation/debugging). */
  raw?: string | null;
  /** Transport / driver failure (no card was ever charged). */
  error?: string | null;
  errorCode?: string | null;
}

export interface NboEcrPluginInterface {
  isAvailable(): Promise<{ available: boolean; deviceAttached: boolean; error?: string }>;
  listDevices(): Promise<{ devices: Array<{ vendorId: number; productId: number; name: string }> }>;
  purchase(options: NboPurchaseOptions): Promise<NboPurchaseResult>;
  /** Aborts the in-flight purchase and clears the amount on the terminal. */
  cancel(): Promise<{ cancelled: boolean; error?: string }>;
}

const NboEcr = registerPlugin<NboEcrPluginInterface>("NboEcr", {
  web: () => import("./nboEcrPluginWeb").then((m) => new m.NboEcrPluginWeb()),
});

export default NboEcr;

export function isNboNativeAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
