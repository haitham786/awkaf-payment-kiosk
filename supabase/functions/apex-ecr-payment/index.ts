import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  ApexEcrConfig,
  baisasToDecimalString,
  buildCancelEnvelope,
  buildEnquiryByRefEnvelope,
  buildSaleEnvelope,
  callApexEcr,
  panLastFour,
} from "../_shared/apexEcr.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Deterministic 6-digit ECR invoice number derived from our transaction id. */
function invoiceNumberFor(transactionId: string): string {
  const hex = transactionId.replace(/-/g, "").slice(0, 8);
  const num = parseInt(hex, 16) % 1000000;
  return String(num).padStart(6, "0");
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action: string = body?.action || "sale";
    const kioskId: string = body?.kioskId || "";
    const transactionId: string = body?.transactionId || "";
    const amount: number = Number(body?.amount);
    const category: string = body?.category || "donation";

    if (!UUID_REGEX.test(kioskId)) {
      return json({ success: false, error: "Invalid kiosk" }, 400, corsHeaders);
    }
    if (action !== "cancel" && action !== "diagnose" && action !== "wsdl" && !UUID_REGEX.test(transactionId)) {
      return json({ success: false, error: "Invalid transaction" }, 400, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: kiosk, error: kioskError } = await supabase
      .from("kiosks")
      .select("id, status, configuration")
      .eq("id", kioskId)
      .maybeSingle();

    if (kioskError || !kiosk || kiosk.status !== "active") {
      return json({ success: false, error: "Kiosk is not active" }, 400, corsHeaders);
    }

    const configuration = (kiosk.configuration ?? {}) as Record<string, unknown>;
    const hardware = (configuration.hardware_pos ?? {}) as Record<string, unknown>;

    const { data: secretRow } = await supabase
      .from("kiosk_secrets")
      .select("apex_secure_key")
      .eq("kiosk_id", kioskId)
      .maybeSingle();

    const config: ApexEcrConfig = {
      serviceUrl: String(hardware.service_url || "").trim(),
      tid: String(hardware.tid || "").trim(),
      mid: String(hardware.mid || "").trim(),
      secureKey: String(secretRow?.apex_secure_key || "").trim(),
      currencyCode: String(hardware.currency_code || "512"),
      tellerUserName: "KIOSK",
      tellerFullName: "KIOSK",
      temNamespace: hardware.tem_namespace ? String(hardware.tem_namespace) : undefined,
      dataNamespace: hardware.data_namespace ? String(hardware.data_namespace) : undefined,
      timeoutSeconds: Number(hardware.timeout_seconds) > 0 ? Number(hardware.timeout_seconds) : 90,
    };

    if (!config.serviceUrl || !config.tid || !config.mid || !config.secureKey) {
      return json(
        { success: false, error: "Hardware POS is not fully configured for this kiosk." },
        400,
        corsHeaders,
      );
    }

    // Pairing guard: a terminal (TID) must belong to exactly one kiosk, otherwise a
    // sale could be pushed to a terminal standing next to a different kiosk.
    const { data: sameTidKiosks } = await supabase
      .from("kiosks")
      .select("id, name, configuration")
      .neq("id", kioskId);

    const conflict = (sameTidKiosks ?? []).find((row) => {
      const cfg = (row.configuration ?? {}) as Record<string, unknown>;
      if (cfg.payment_mode !== "hardware_pos") return false;
      const hw = (cfg.hardware_pos ?? {}) as Record<string, unknown>;
      return String(hw.tid || "").trim() === config.tid;
    });

    if (conflict) {
      console.error("Terminal pairing conflict for TID", config.tid, "kiosks:", kioskId, conflict.id);
      return json(
        {
          success: false,
          error: `Terminal ${config.tid} is paired with more than one kiosk. Fix the kiosk configuration before taking payments.`,
        },
        400,
        corsHeaders,
      );
    }

    if (!/^https:\/\//i.test(config.serviceUrl)) {
      return json({ success: false, error: "ApexECR service URL must use HTTPS." }, 400, corsHeaders);
    }


    // ------------------------------------------------------------------ wsdl
    // Fetches the service contract (or an imported schema) so the exact SOAP
    // operations and namespaces can be verified against the live service.
    if (action === "wsdl") {
      const target = String(body?.url || `${config.serviceUrl}?wsdl`);
      if (!target.startsWith(config.serviceUrl.split("/").slice(0, 3).join("/"))) {
        return json({ success: false, error: "URL outside the ApexECR host" }, 400, corsHeaders);
      }
      const res = await fetch(target, { method: "GET" });
      const text = await res.text();
      return json({ success: true, status: res.status, length: text.length, body: text.slice(0, 90000) }, 200, corsHeaders);
    }

    // -------------------------------------------------------------- diagnose
    // Connectivity check used by the admin panel. Never touches a card; it just
    // proves the backend can reach the ApexECR service over HTTPS.
    if (action === "diagnose") {
      const probes: Record<string, unknown>[] = [];

      try {
        const wsdlRes = await fetch(`${config.serviceUrl}?wsdl`, { method: "GET" });
        const wsdlText = await wsdlRes.text();
        probes.push({
          probe: "wsdl",
          status: wsdlRes.status,
          contentType: wsdlRes.headers.get("content-type") || "",
          isWsdl: /wsdl:definitions|<definitions/i.test(wsdlText),
          snippet: wsdlText.slice(0, 200),
        });
      } catch (err) {
        probes.push({ probe: "wsdl", error: err instanceof Error ? err.message : "failed" });
      }

      try {
        const soap = await callApexEcr(
          config,
          buildCancelEnvelope(config),
          `${config.temNamespace || "http://tempuri.org/"}IApexEcr/CancelLastRequest`,
        );
        probes.push({
          probe: "soap",
          status: soap.httpStatus ?? null,
          contentType: soap.contentType ?? null,
          webResponseStatus: soap.webResponseStatus,
          webResponseErrorDesc: soap.webResponseErrorDesc,
          snippet: soap.raw.slice(0, 300),
        });
      } catch (err) {
        probes.push({ probe: "soap", error: err instanceof Error ? err.message : "failed" });
      }

      return json({ success: true, tid: config.tid, mid: config.mid, serviceUrl: config.serviceUrl, probes }, 200, corsHeaders);
    }

    // ---------------------------------------------------------------- cancel
    if (action === "cancel") {
      try {
        const result = await callApexEcr(
          config,
          buildCancelEnvelope(config),
          `${config.temNamespace || "http://tempuri.org/"}IApexEcr/CancelLastRequest`,
        );
        return json(
          {
            success: true,
            cancelled: result.webResponseStatus !== "99",
            error: result.webResponseStatus === "99" ? result.webResponseErrorDesc : undefined,
          },
          200,
          corsHeaders,
        );
      } catch (_err) {
        return json({ success: true, cancelled: false }, 200, corsHeaders);
      }
    }

    const invoiceNumber = invoiceNumberFor(transactionId);

    // --------------------------------------------------------------- enquiry
    if (action === "enquiry") {
      const result = await callApexEcr(
        config,
        buildEnquiryByRefEnvelope(config, invoiceNumber, String(body?.rrn || ""), String(body?.authCode || "")),
        `${config.temNamespace || "http://tempuri.org/"}IApexEcr/EnquiryByRef`,
      );
      return json(
        {
          success: true,
          approved: result.approved,
          invoiceNumber,
          rrn: result.posRRN,
          authCode: result.posAuthCode,
          responseText: result.posRespText,
        },
        200,
        corsHeaders,
      );
    }

    // ------------------------------------------------------------------ sale
    if (!Number.isInteger(amount) || amount < 100 || amount > 100000000) {
      return json({ success: false, error: "Invalid amount" }, 400, corsHeaders);
    }

    const saleResult = await callApexEcr(
      config,
      buildSaleEnvelope(config, {
        amount: baisasToDecimalString(amount),
        invoiceNumber,
        referenceNumber: transactionId,
      }),
      `${config.temNamespace || "http://tempuri.org/"}IApexEcr/PerformFinancialTransaction`,
    );

    if (saleResult.webResponseStatus === "99") {
      console.error("ApexECR web failure:", saleResult.webResponseErrorDesc);
      return json(
        {
          success: false,
          approved: false,
          invoiceNumber,
          error: saleResult.webResponseErrorDesc || "Terminal service error",
        },
        200,
        corsHeaders,
      );
    }

    // Record the transaction through the existing pipeline so reporting,
    // reference numbers and receipts behave exactly as they do today.
    const internalToken = Deno.env.get("INTERNAL_PAYMENT_TOKEN") ?? "";
    let referenceNumber: string | null = null;

    try {
      const processRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-internal-token": internalToken,
        },
        body: JSON.stringify({
          transactionId,
          kioskId,
          amount,
          category,
          mobileNumber: null,
          paymentType: "hardware_pos",
          provider: "apex_ecr",
          posResponse: {
            success: saleResult.approved,
            responseCode: saleResult.posRespCode || (saleResult.approved ? "00" : "05"),
            rrn: saleResult.posRRN || null,
            authCode: saleResult.posAuthCode || null,
            tid: config.tid,
            mid: config.mid,
            cardType: saleResult.posIssuerName || null,
            cardLastFour: panLastFour(saleResult.posPan),
            invoiceNumber: saleResult.posInvoiceNumber || invoiceNumber,
            batchNumber: saleResult.posBatchNumber || null,
            stan: saleResult.posStan || null,
            posDate: saleResult.posDate || null,
            posTime: saleResult.posTime || null,
            respText: saleResult.posRespText || null,
            cvmId: saleResult.posCVMId || null,
          },
        }),
      });

      const processBody = await processRes.json().catch(() => ({}));
      referenceNumber = processBody?.transaction?.reference_number ?? null;
    } catch (recordError) {
      console.error("Failed to record hardware POS transaction:", recordError);
    }

    return json(
      {
        success: true,
        approved: saleResult.approved,
        invoiceNumber,
        referenceNumber,
        rrn: saleResult.posRRN,
        authCode: saleResult.posAuthCode,
        responseCode: saleResult.posRespCode,
        responseText: saleResult.posRespText,
        cardType: saleResult.posIssuerName,
        cardLastFour: panLastFour(saleResult.posPan),
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const aborted = /abort/i.test(message);
    console.error("apex-ecr-payment error:", message);
    return json(
      {
        success: false,
        approved: false,
        error: aborted ? "The terminal did not respond in time." : "Terminal request failed.",
        timedOut: aborted,
      },
      200,
      corsHeaders,
    );
  }
});
