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
export const APEX_DEFAULT_CONTRACT = "IApexEcr";

export type SoapVersion = "1.1" | "1.2";

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
  /** WCF service contract name used to build the SOAPAction, e.g. "IApexEcr". */
  contractName?: string;
  /** WCF basicHttpBinding = 1.1, wsHttpBinding / SOAP 1.2 bindings = 1.2. */
  soapVersion?: SoapVersion;
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
  return `
      <${ns}Config>
        <${ns}EcrCurrencyCode>${escapeXml(config.currencyCode)}</${ns}EcrCurrencyCode>
        <${ns}EcrTillerFullName>${escapeXml(config.tellerFullName || "KIOSK")}</${ns}EcrTillerFullName>
        <${ns}EcrTillerUserName>${escapeXml(config.tellerUserName || "KIOSK")}</${ns}EcrTillerUserName>
        <${ns}MerchantSecureKey>${escapeXml(config.secureKey)}</${ns}MerchantSecureKey>
        <${ns}Mid>${escapeXml(config.mid)}</${ns}Mid>
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
        <${ns}PrinterWidth>0</${ns}PrinterWidth>
        <${ns}ReceiptNote></${ns}ReceiptNote>
        <${ns}ReferenceNumber>${escapeXml(referenceNumber)}</${ns}ReferenceNumber>
      </${ns}Printer>`;
}

export function buildSaleEnvelope(config: ApexEcrConfig, request: ApexSaleRequest): string {
  const tem = config.temNamespace || APEX_DEFAULT_TEM_NS;
  const data = config.dataNamespace || APEX_DEFAULT_DATA_NS;
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${tem}" xmlns:ns="${data}">
  <soapenv:Body>
    <tem:PerformFinancialTransaction>
      <tem:webReq>${configBlock(config, "ns:")}${printerBlock("ns:", request.invoiceNumber, request.referenceNumber)}
        <ns:TransactionType>SALE</ns:TransactionType>
        <ns:EcrAmount>${escapeXml(request.amount)}</ns:EcrAmount>
        <ns:InvoiceNumber>${escapeXml(request.invoiceNumber)}</ns:InvoiceNumber>
      </tem:webReq>
    </tem:PerformFinancialTransaction>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function buildEnquiryByRefEnvelope(
  config: ApexEcrConfig,
  origInvoiceNumber: string,
  origRrn: string,
  origAuthCode = "",
): string {
  const tem = config.temNamespace || APEX_DEFAULT_TEM_NS;
  const data = config.dataNamespace || APEX_DEFAULT_DATA_NS;
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${tem}" xmlns:ns="${data}">
  <soapenv:Body>
    <tem:EnquiryByRef>
      <tem:webReq>${configBlock(config, "ns:")}${printerBlock("ns:", origInvoiceNumber, origInvoiceNumber)}
        <ns:OrigAuthCode>${escapeXml(origAuthCode)}</ns:OrigAuthCode>
        <ns:OrigInvoiceNumber>${escapeXml(origInvoiceNumber)}</ns:OrigInvoiceNumber>
        <ns:OrigRrn>${escapeXml(origRrn)}</ns:OrigRrn>
      </tem:webReq>
    </tem:EnquiryByRef>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function buildCancelEnvelope(config: ApexEcrConfig): string {
  const tem = config.temNamespace || APEX_DEFAULT_TEM_NS;
  const data = config.dataNamespace || APEX_DEFAULT_DATA_NS;
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${tem}" xmlns:ns="${data}">
  <soapenv:Body>
    <tem:CancelLastRequest>
      <tem:webReq>${configBlock(config, "ns:")}
      </tem:webReq>
    </tem:CancelLastRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function parseApexResponse(xml: string): ApexEcrResult {
  const posRespStatus = pickTag(xml, "PosRespStatus");
  const webResponseStatus = pickTag(xml, "WebResponseStatus");
  const webOk = webResponseStatus === "" ||
    webResponseStatus === "0" ||
    webResponseStatus.toLowerCase() === "success";

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
    approved: webOk && posRespStatus === "1",
    raw: xml,
  };
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
): Promise<ApexEcrResult> {
  const timeoutMs = Math.max(5, config.timeoutSeconds ?? 90) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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

    if (!response.ok) {
      return {
        ...parseApexResponse(text),
        webResponseStatus: "99",
        webResponseErrorDesc: `ApexECR HTTP ${response.status}`,
        approved: false,
      };
    }

    return parseApexResponse(text);
  } finally {
    clearTimeout(timer);
  }
}
