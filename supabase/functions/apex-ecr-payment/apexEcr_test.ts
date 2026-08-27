import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  baisasToDecimalString,
  buildSaleEnvelope,
  isAnotherTransactionInProgress,
  isSuccessfulWebResponse,
  parseApexResponse,
  type ApexEcrConfig,
} from "../_shared/apexEcr.ts";

const config: ApexEcrConfig = {
  serviceUrl: "https://example.test/EcrComInterface.svc",
  tid: "12345678",
  mid: "123456789012345",
  secureKey: "01234567890123456789012345678901",
  currencyCode: "512",
};

Deno.test("builds Sale in the live AFS data-contract order", () => {
  const xml = buildSaleEnvelope(config, {
    amount: "1.250",
    invoiceNumber: "123456",
    referenceNumber: "test-reference",
  });
  const configIndex = xml.indexOf("<ns:Config>");
  const amountIndex = xml.indexOf("<ns:EcrAmount>1.250</ns:EcrAmount>");
  const printerIndex = xml.indexOf("<ns:Printer>");

  assert(configIndex > -1 && configIndex < amountIndex && amountIndex < printerIndex);
  assertStringIncludes(xml, "<tem:Sale>");
  assertStringIncludes(xml, "<ns:EcrCurrencyCode>512</ns:EcrCurrencyCode>");
  assertStringIncludes(xml, "<ns:Tid>12345678</ns:Tid>");
});

Deno.test("treats AFS Faild as a terminal routing failure", () => {
  const result = parseApexResponse(`
    <SaleResponse>
      <WebResponseStatus>Faild</WebResponseStatus>
      <WebResponseErrorDesc>Terminal is offline</WebResponseErrorDesc>
      <PosRespStatus>0</PosRespStatus>
    </SaleResponse>
  `);

  assertEquals(result.approved, false);
  assertEquals(result.webResponseErrorDesc, "Terminal is offline");
  assertEquals(isSuccessfulWebResponse(result.webResponseStatus), false);
});

Deno.test("recognizes successful web response values and formats OMR", () => {
  assertEquals(isSuccessfulWebResponse("Success"), true);
  assertEquals(isSuccessfulWebResponse("0"), true);
  assertEquals(baisasToDecimalString(1250), "1.250");
});

Deno.test("recognizes the Apex terminal-busy response for stale-session recovery", () => {
  assertEquals(
    isAnotherTransactionInProgress("Another transaction under processing, waiting for POS feedback"),
    true,
  );
  assertEquals(isAnotherTransactionInProgress("Terminal is offline"), false);
});