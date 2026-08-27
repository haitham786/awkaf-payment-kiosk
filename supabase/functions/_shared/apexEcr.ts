/**
 * ApexECR (Apex Payment Solutions) SOAP helpers.
 *
 * Used for the Ahli Bank / AFS external hardware EFTPOS terminal integration.
 * The kiosk never talks to ApexECR directly — only edge functions do, so the
 * MID / TID / MerchantSecureKey never leave the backend.
 *
 * Reference: "ApexECR Web Integration Specification v1.08".
 *
 * NOTE: namespaces and the SOAPAction values below follow the samples in the
 * specification. They are overridable per kiosk (see ApexEcrConfig) so they can
 * be corrected against the official WSDL without a code change.
 */

export const APEX_DEFAULT_TEM_NS = "http://tempuri.org/";
export const APEX_DEFAULT_DATA_NS = "http://schemas.datacontract.org/2004/07/";

/** SOAPAction values taken from the live WSDL (portType IEcrComInterface). */
export const APEX_SOAP_ACTIONS = {
  sale: "http://tempuri.org/IEcrComInterface/Sale",
  cancel: "http://tempuri.org/IEcrComInterface/RequestCancellation",
  enquiryByRef: "http://tempuri.org/IEcrComInterface/EnquiryByRef",
  enquiry: "http://tempuri.org/IEcrComInterface/Enquiry",
} as const;

export interface ApexEcrConfig {
  serviceUrl: string;
  tid: string;
  mid: string;
  secureKey: string;
  currencyCode: string; // ISO numeric, OMR = 512
  tellerUserName?: string;
  tellerFullName?: string;
  temNamespace?: string;
  dataNamespace?: string;
  integratorName?: string;
  tenant?: string;
  /** Seconds to wait for the donor to tap the card at the terminal. */
  timeoutSeconds?: number;
}

export interface ApexSaleRequest {
  amount: string; // decimal string, e.g. "13.500"
  invoiceNumber: string;
  referenceNumber: string;
}

export interface ApexEcrResult {
  webResponseStatus: string;
  webResponseErrorDesc: string;
  posRespStatus: string; // -1 unknown, 0 declined, 1 approved
  posRespCode: string;
  posRespText: string;
  posAmount: string;
  posCurrencyCode: string;
  posRRN: string;
  posAuthCode: string;
  posInvoiceNumber: string;
  posBatchNumber: string;
  posStan: string;
  posDate: string;
  posTime: string;
  posTxnName: string;
  posCVMId: string;
  posPan: string;
  posIssuerName: string;
  posCardEntryModeId: string;
  posReceipt: string;
  approved: boolean;
  raw: string;
  httpStatus?: number;
  contentType?: string;
  faultCode?: string;
  faultMessage?: string;
  elapsedMs?: number;
}

export function escapeXml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Extract the inner text of the first occurrence of a tag, ignoring namespace prefixes. */
export function pickTag(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${tag}>`, "i");
  const match = xml.match(re);
  if (!match) {
    // Self-closing / empty element.
    const empty = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${tag}\\b[^>]*/>`, "i");
    return empty.test(xml) ? "" : "";
  }
  return decodeXml(match[1].trim());
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Baisa integer -> ApexECR decimal amount string with 3 decimals (OMR). */
export function baisasToDecimalString(baisas: number): string {
  const rials = Math.floor(baisas / 1000);
  const remainder = baisas % 1000;
  return `${rials}.${String(remainder).padStart(3, "0")}`;
}

function configBlock(config: ApexEcrConfig, ns: string): string {
  // Element order must match the WCF data contract (alphabetical within EcrConfig).
  return `
        <${ns}Config>
          <${ns}EcrCurrencyCode>${escapeXml(config.currencyCode)}</${ns}EcrCurrencyCode>
          <${ns}EcrTillerFullName>${escapeXml(config.tellerFullName || "KIOSK")}</${ns}EcrTillerFullName>
          <${ns}EcrTillerUserName>${escapeXml(config.tellerUserName || "KIOSK")}</${ns}EcrTillerUserName>
          <${ns}IntegratorName>${escapeXml(config.integratorName || "AWKAF-KIOSK")}</${ns}IntegratorName>
          <${ns}MerchantSecureKey>${escapeXml(config.secureKey)}</${ns}MerchantSecureKey>
          <${ns}Mid>${escapeXml(config.mid)}</${ns}Mid>
          <${ns}Tenant>${escapeXml(config.tenant || "")}</${ns}Tenant>
          <${ns}Tid>${escapeXml(config.tid)}</${ns}Tid>
        </${ns}Config>`;
}

/**
 * Printer block. Receipts are delivered by SMS / WhatsApp, so the terminal is
 * told not to print anything (EnablePrintPosReceipt = 0).
 */
function printerBlock(ns: string, invoiceNumber: string, referenceNumber: string): string {
  return `
        <${ns}Printer>
          <${ns}EnablePrintPosReceipt>0</${ns}EnablePrintPosReceipt>
          <${ns}EnablePrintReceiptNote>0</${ns}EnablePrintReceiptNote>
          <${ns}InvoiceNumber>${escapeXml(invoiceNumber)}</${ns}InvoiceNumber>
          <${ns}PrinterWidth>40</${ns}PrinterWidth>
          <${ns}ReceiptNote></${ns}ReceiptNote>
          <${ns}ReferenceNumber>${escapeXml(referenceNumber)}</${ns}ReferenceNumber>
        </${ns}Printer>`;
}

function envelope(config: ApexEcrConfig, operation: string, inner: string): string {
  const tem = config.temNamespace || APEX_DEFAULT_TEM_NS;
  const data = config.dataNamespace || APEX_DEFAULT_DATA_NS;
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${tem}" xmlns:ns="${data}">
  <soapenv:Body>
    <tem:${operation}>
      <tem:webReq>${inner}
      </tem:webReq>
    </tem:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Sale: SaleRequest = { Config, EcrAmount, Printer } in that exact order. */
export function buildSaleEnvelope(config: ApexEcrConfig, request: ApexSaleRequest): string {
  const inner = `${configBlock(config, "ns:")}
        <ns:EcrAmount>${escapeXml(request.amount)}</ns:EcrAmount>${printerBlock("ns:", request.invoiceNumber, request.referenceNumber)}`;
  return envelope(config, "Sale", inner);
}

/** EnquiryByRef: EnquiryRequest = { Config, OrigAuthCode, OrigInvoiceNumber, OrigRrn, Printer }. */
export function buildEnquiryByRefEnvelope(
  config: ApexEcrConfig,
  origInvoiceNumber: string,
  origRrn: string,
  origAuthCode = "",
  referenceNumber = origInvoiceNumber,
): string {
  const inner = `${configBlock(config, "ns:")}
        <ns:OrigAuthCode>${escapeXml(origAuthCode)}</ns:OrigAuthCode>
        <ns:OrigInvoiceNumber>${escapeXml(origInvoiceNumber)}</ns:OrigInvoiceNumber>
        <ns:OrigRrn>${escapeXml(origRrn)}</ns:OrigRrn>${printerBlock("ns:", origInvoiceNumber, referenceNumber)}`;
  return envelope(config, "EnquiryByRef", inner);
}

/** RequestCancellation: CancelRequest = { Config }. */
export function buildCancelEnvelope(config: ApexEcrConfig): string {
  return envelope(config, "RequestCancellation", configBlock(config, "ns:"));
}

export function parseApexResponse(xml: string): ApexEcrResult {
  const posRespStatus = pickTag(xml, "PosRespStatus");
  const webResponseStatus = pickTag(xml, "WebResponseStatus");
  const webOk = isSuccessfulWebResponse(webResponseStatus);
  const faultCode = pickTag(xml, "faultcode") || pickTag(xml, "Code");
  const faultMessage = pickTag(xml, "faultstring") || pickTag(xml, "Reason");

  return {
    webResponseStatus,
    webResponseErrorDesc: pickTag(xml, "WebResponseErrorDesc"),
    posRespStatus,
    posRespCode: pickTag(xml, "PosRespCode"),
    posRespText: pickTag(xml, "PosRespText"),
    posAmount: pickTag(xml, "PosAmount"),
    posCurrencyCode: pickTag(xml, "PosCurrencyCode"),
    posRRN: pickTag(xml, "PosRRN"),
    posAuthCode: pickTag(xml, "PosAuthCode"),
    posInvoiceNumber: pickTag(xml, "PosInvoiceNumber"),
    posBatchNumber: pickTag(xml, "PosBatchNumber"),
    posStan: pickTag(xml, "PosStan"),
    posDate: pickTag(xml, "PosDate"),
    posTime: pickTag(xml, "PosTime"),
    posTxnName: pickTag(xml, "PosTxnName"),
    posCVMId: pickTag(xml, "PosCVMId"),
    posPan: pickTag(xml, "PosPan"),
    posIssuerName: pickTag(xml, "PosIssuerName"),
    posCardEntryModeId: pickTag(xml, "PosCardEntryModeId"),
    posReceipt: pickTag(xml, "PosReceipt"),
    approved: webOk && isApprovedPosResponse(
      posRespStatus,
      pickTag(xml, "PosRespCode"),
      pickTag(xml, "PosAuthCode"),
      pickTag(xml, "PosRRN"),
      pickTag(xml, "PosRespText"),
    ),

    raw: xml,
    faultCode,
    faultMessage,
  };
}

/** AFS uses a string enum and misspells its failure value as `Faild`. */
export function isSuccessfulWebResponse(status: string): boolean {
  return ["0", "success", "ok", "completed", "successful"]
    .includes(String(status || "").trim().toLowerCase());
}

/**
 * Terminal-level approval. Apex documents PosRespStatus = 1 for approved, but
 * live responses also use `true` / `Approved`, and occasionally omit the field
 * entirely while returning an approval response code with an auth code / RRN.
 */
export function isApprovedPosResponse(
  posRespStatus: string,
  posRespCode: string,
  posAuthCode: string,
  posRRN: string,
  posRespText: string,
): boolean {
  const status = String(posRespStatus || "").trim().toLowerCase();
  if (["1", "true", "approved", "approve", "success"].includes(status)) return true;
  if (["0", "-1", "false", "declined", "decline"].includes(status)) return false;

  // Status missing/unknown: fall back to the issuer response.
  const code = String(posRespCode || "").trim();
  const approvedCode = code === "00" || code === "000";
  const hasProof = !!String(posAuthCode || "").trim() || !!String(posRRN || "").trim();
  const approvedText = /approved|accepted/i.test(String(posRespText || ""));
  return (approvedCode && hasProof) || (approvedCode && approvedText);
}

/** Masks a PAN inside a raw SOAP body so replies can be logged safely. */
export function redactApexRaw(xml: string): string {
  return String(xml || "")
    .replace(/(<(?:[A-Za-z0-9_.-]+:)?PosPan\b[^>]*>)([\s\S]*?)(<\/)/gi, "$1***$3")
    .replace(/(<(?:[A-Za-z0-9_.-]+:)?MerchantSecureKey\b[^>]*>)([\s\S]*?)(<\/)/gi, "$1***$3")
    .replace(/(<(?:[A-Za-z0-9_.-]+:)?PosReceipt\b[^>]*>)([\s\S]*?)(<\/)/gi, "$1***$3")
    .slice(0, 4000);
}


/**
 * Apex rejects a new SALE while the terminal is still waiting for feedback
 * from the previous request. This response is safe to recover from because the
 * new SALE was not accepted by Apex; cancel the last request, then submit once.
 */
export function isAnotherTransactionInProgress(message: string): boolean {
  return /another\s+transaction\s+(?:is\s+)?(?:under|in)\s+process(?:ing)?|waiting\s+for\s+pos\s+feedback/i
    .test(String(message || ""));
}

/** Last four digits of a masked PAN such as "470468******4250". */
export function panLastFour(pan: string): string | null {
  const digits = String(pan || "").replace(/[^0-9]/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export async function callApexEcr(
  config: ApexEcrConfig,
  envelope: string,
  soapAction: string,
  timeoutMsOverride?: number,
): Promise<ApexEcrResult> {
  const timeoutMs = timeoutMsOverride && timeoutMsOverride > 0
    ? timeoutMsOverride
    : Math.max(5, config.timeoutSeconds ?? 90) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(config.serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": soapAction,
      },
      body: envelope,
      signal: controller.signal,
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const looksHtml = /^\s*<(!doctype|html)/i.test(text) || contentType.includes("text/html");

    const parsed = parseApexResponse(text);
    if (!response.ok || looksHtml || parsed.faultCode || parsed.faultMessage) {
      return {
        ...parsed,
        webResponseStatus: "99",
        webResponseErrorDesc: parsed.faultMessage || (!response.ok
          ? `ApexECR HTTP ${response.status}${looksHtml ? " (HTML/WAF response)" : ""}`
          : "ApexECR returned an HTML page instead of SOAP (likely a firewall/WAF block or wrong service URL)"),
        approved: false,
        httpStatus: response.status,
        contentType,
        elapsedMs: Date.now() - startedAt,
      };
    }

    return { ...parsed, httpStatus: response.status, contentType, elapsedMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}
