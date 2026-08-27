import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  ApexEcrConfig,
  ApexEcrResult,
  baisasToDecimalString,
  buildCancelEnvelope,
  buildEnquiryByRefEnvelope,
  buildSaleEnvelope,
  callApexEcr,
  APEX_SOAP_ACTIONS,
  isAnotherTransactionInProgress,
  isSuccessfulWebResponse,
  isApprovedPosResponse,
  redactApexRaw,
  panLastFour,

} from "../_shared/apexEcr.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONFIG_CACHE_TTL_MS = 600_000;
const terminalConfigCache = new Map<string, { config: ApexEcrConfig; status: string; cachedAt: number }>();

interface TerminalAcquisition {
  acquisition: "acquired" | "completed" | "duplicate_active" | "stale_recovery" | "busy";
  owner_transaction_id: string;
  session_state: string;
  stored_result: Record<string, unknown> | null;
}

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

function classifyFailure(result: { httpStatus?: number; contentType?: string; webResponseErrorDesc: string; faultCode?: string; faultMessage?: string }) {
  if (result.httpStatus === 522 || /WAF|HTML page/i.test(result.webResponseErrorDesc)) return "afs_network_block";
  if (result.faultCode || result.faultMessage) return "soap_fault";
  if (result.httpStatus && result.httpStatus >= 400) return "afs_http_error";
  return "apex_rejected";
}

function safeApexError(result: { webResponseErrorDesc: string; posRespText: string; posRespCode: string }): string {
  const message = result.webResponseErrorDesc || result.posRespText;
  return message || (result.posRespCode ? `AFS response code ${result.posRespCode}` : "AFS did not route the request to the terminal.");
}

/**
 * Stores an approved/declined terminal result through the existing
 * process-payment pipeline so reporting, reference numbers and receipts behave
 * identically no matter which code path discovered the outcome.
 */
async function recordApexTransaction(params: {
  transactionId: string;
  kioskId: string;
  amount: number;
  category: string;
  config: ApexEcrConfig;
  result: ApexEcrResult;
  invoiceNumber: string;
}): Promise<string | null> {
  const { transactionId, kioskId, amount, category, config, result, invoiceNumber } = params;
  try {
    const processRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "x-internal-token": Deno.env.get("INTERNAL_PAYMENT_TOKEN") ?? "",
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
          success: result.approved,
          responseCode: result.posRespCode || (result.approved ? "00" : "05"),
          rrn: result.posRRN || null,
          authCode: result.posAuthCode || null,
          tid: config.tid,
          mid: config.mid,
          cardType: result.posIssuerName || null,
          cardLastFour: panLastFour(result.posPan),
          invoiceNumber: result.posInvoiceNumber || invoiceNumber,
          batchNumber: result.posBatchNumber || null,
          stan: result.posStan || null,
          posDate: result.posDate || null,
          posTime: result.posTime || null,
          respText: result.posRespText || null,
          cvmId: result.posCVMId || null,
        },
      }),
    });
    const processBody = await processRes.json().catch(() => ({}));
    return processBody?.transaction?.reference_number ?? null;
  } catch (recordError) {
    console.error("Failed to record hardware POS transaction:", recordError);
    return null;
  }
}


serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const requestStartedAt = Date.now();
    const body = await req.json();
    const action: string = body?.action || "sale";
    const kioskId: string = body?.kioskId || "";
    const transactionId: string = body?.transactionId || "";
    const amount: number = Number(body?.amount);
    const category: string = body?.category || "donation";
    const correlationId = crypto.randomUUID();

    if (!UUID_REGEX.test(kioskId)) {
      return json({ success: false, error: "Invalid kiosk" }, 400, corsHeaders);
    }
    if (action !== "diagnose" && action !== "wsdl" && action !== "warm" && !UUID_REGEX.test(transactionId)) {
      return json({ success: false, error: "Invalid transaction" }, 400, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const configLookupStartedAt = Date.now();
    const refreshConfig = body?.refreshConfig === true;
    if (refreshConfig) terminalConfigCache.delete(kioskId);
    const cached = terminalConfigCache.get(kioskId);
    let config: ApexEcrConfig;
    let kioskStatus: string;

    if (cached && Date.now() - cached.cachedAt < CONFIG_CACHE_TTL_MS) {
      config = cached.config;
      kioskStatus = cached.status;
    } else {
      // Only load this kiosk. MID/TID uniqueness is enforced when configuration
      // is saved, so no unrelated-kiosk scan belongs on the SALE hot path.
      const [kioskRes, secretRes] = await Promise.all([
        supabase.from("kiosks").select("id, status, configuration").eq("id", kioskId).maybeSingle(),
        supabase.from("kiosk_secrets").select("apex_secure_key").eq("kiosk_id", kioskId).maybeSingle(),
      ]);
      const kiosk = kioskRes.data;
      if (kioskRes.error || !kiosk) {
        return json({ success: false, error: "Kiosk is not active" }, 400, corsHeaders);
      }

      const configuration = (kiosk.configuration ?? {}) as Record<string, unknown>;
      const hardware = (configuration.hardware_pos ?? {}) as Record<string, unknown>;
      config = {
        serviceUrl: String(hardware.service_url || "").trim(),
        tid: String(hardware.tid || "").trim(),
        mid: String(hardware.mid || "").trim(),
        secureKey: String(secretRes.data?.apex_secure_key || "").trim(),
        currencyCode: String(hardware.currency_code || "512"),
        tellerUserName: "KIOSK",
        tellerFullName: "KIOSK",
        temNamespace: hardware.tem_namespace ? String(hardware.tem_namespace) : undefined,
        dataNamespace: hardware.data_namespace ? String(hardware.data_namespace) : undefined,
        timeoutSeconds: Number(hardware.timeout_seconds) > 0 ? Number(hardware.timeout_seconds) : 90,
      };
      kioskStatus = kiosk.status;
      // Never cache an unusable configuration: a wiped or half-saved terminal
      // setup must be re-read on the next attempt instead of being pinned for
      // ten minutes inside a warm isolate.
      if (config.serviceUrl && config.tid && config.mid && config.secureKey) {
        terminalConfigCache.set(kioskId, { config, status: kioskStatus, cachedAt: Date.now() });
      } else {
        terminalConfigCache.delete(kioskId);
      }
    }

    if (kioskStatus !== "active") {
      return json({ success: false, error: "Kiosk is not active" }, 400, corsHeaders);
    }

    if (!config.serviceUrl || !config.tid || !config.mid || !config.secureKey) {
      const missing = [
        config.serviceUrl ? null : "Service URL",
        config.mid ? null : "MID",
        config.tid ? null : "TID",
        config.secureKey ? null : "Merchant Secure Key",
      ].filter(Boolean).join(", ");
      console.error("ApexECR configuration incomplete", { correlationId, kioskId, missing });
      return json(
        {
          success: false,
          error: `Hardware POS is not fully configured for this kiosk. Missing: ${missing}. Open Manage Kiosks → Edit kiosk → Hardware POS and re-enter these values.`,
          missing,
          failureType: "not_configured",
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
    // Checks the live WSDL, then sends a non-financial enquiry with impossible
    // original references. This validates SOAP transport and merchant routing
    // without opening a Sale or charging a card.
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
        });
      } catch (err) {
        probes.push({ probe: "wsdl", error: err instanceof Error ? err.message : "failed" });
      }

      try {
        const soap = await callApexEcr(
          config,
          buildEnquiryByRefEnvelope(config, "000000", "000000000000", "", `VERIFY-${correlationId.slice(0, 8)}`),
          APEX_SOAP_ACTIONS.enquiryByRef,
        );
        probes.push({
          probe: "soap",
          ok: soap.httpStatus === 200 && isSuccessfulWebResponse(soap.webResponseStatus) && !soap.faultCode,
          status: soap.httpStatus ?? null,
          contentType: soap.contentType ?? null,
          webResponseStatus: soap.webResponseStatus,
          webResponseErrorDesc: soap.webResponseErrorDesc,
          posRespStatus: soap.posRespStatus,
          responseCode: soap.posRespCode,
          responseText: soap.posRespText,
          faultCode: soap.faultCode || null,
          faultMessage: soap.faultMessage || null,
          elapsedMs: soap.elapsedMs ?? null,
          failureType: !isSuccessfulWebResponse(soap.webResponseStatus) ? classifyFailure(soap) : null,
        });
      } catch (err) {
        probes.push({ probe: "soap", error: err instanceof Error ? err.message : "failed" });
      }

      const wsdlOk = probes.some((probe) => probe.probe === "wsdl" && probe.status === 200 && probe.isWsdl === true);
      const soapOk = probes.some((probe) => probe.probe === "soap" && probe.ok === true);
      return json({
        success: wsdlOk && soapOk,
        correlationId,
        checks: { serviceReachable: wsdlOk, soapAccepted: soapOk, terminalAvailable: null },
        error: !wsdlOk
          ? "The AFS service contract is unreachable."
          : !soapOk
            ? "The AFS service is reachable, but it rejected the terminal request. Check the returned AFS error and ask AFS/Ahli Bank to confirm this TID is online and paired to the supplied MID and merchant key."
            : undefined,
        probes,
      }, 200, corsHeaders);
    }

    /**
     * Sends RequestCancellation to the terminal. Kept on a short timeout so the
     * donor never waits: the terminal must drop back to its idle screen quickly.
     * Retried once because a terminal that is mid-prompt can reject the first
     * cancellation while it switches state.
     */
    const cancelAtTerminal = async (): Promise<{ cancelled: boolean; error?: string }> => {
      let lastError: string | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await callApexEcr(
            config,
            buildCancelEnvelope(config),
            APEX_SOAP_ACTIONS.cancel,
            12000,
          );
          if (
            isSuccessfulWebResponse(result.webResponseStatus) ||
            /transaction\s+not\s+found|no\s+(?:active|pending)\s+transaction/i.test(result.webResponseErrorDesc)
          ) {
            return { cancelled: true };
          }
          lastError = result.webResponseErrorDesc || "Cancellation rejected";
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Cancellation failed";
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return { cancelled: false, error: lastError };
    };

    // ------------------------------------------------------------------ warm
    // Idle readiness probe. Keeps this isolate hot, primes the terminal
    // configuration cache above and re-opens the TLS session to the AFS host so
    // the SALE goes out instantly. It also reports the coordinator state so the
    // kiosk can show live readiness, and — only when nothing is paying — clears
    // a terminal session whose lease has already expired.
    if (action === "warm") {
      let hostReachable = false;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${config.serviceUrl}?wsdl`, { method: "GET", signal: controller.signal });
        clearTimeout(timer);
        await res.arrayBuffer();
        hostReachable = res.status < 500;
      } catch {
        hostReachable = false;
      }

      const { data: sessionRow } = await supabase
        .from("apex_terminal_sessions")
        .select("transaction_id, state, lease_expires_at")
        .eq("kiosk_id", kioskId)
        .maybeSingle();

      const activeStates = ["active", "cancelling", "recovering"];
      const sessionState = String(sessionRow?.state || "idle");
      const leaseExpired = sessionRow
        ? new Date(sessionRow.lease_expires_at).getTime() <= Date.now()
        : true;
      let busy = activeStates.includes(sessionState) && !leaseExpired;
      let staleCleared: boolean | null = null;

      // Idle-only recovery: an expired lease means no live donor owns the
      // terminal, so the orphaned prompt is cleared before the next donor.
      if (body?.releaseStale === true && activeStates.includes(sessionState) && leaseExpired) {
        const recovered = await cancelAtTerminal();
        staleCleared = recovered.cancelled;
        if (recovered.cancelled) {
          await supabase.rpc("finish_apex_terminal_session", {
            _kiosk_id: kioskId,
            _transaction_id: sessionRow!.transaction_id,
            _state: "cancelled",
            _result: { success: true, cancelled: true, reason: "idle_stale_release" },
          });
          busy = false;
        } else {
          busy = true;
        }
        console.warn("ApexECR idle stale release", { correlationId, tid: config.tid, cleared: recovered.cancelled, error: recovered.error });
      }

      console.log("ApexECR warm", {
        correlationId,
        tid: config.tid,
        hostReachable,
        sessionState,
        busy,
        ms: Date.now() - requestStartedAt,
      });
      return json({
        success: true,
        warmed: true,
        hostReachable,
        sessionState,
        leaseExpired,
        busy,
        staleCleared,
      }, 200, corsHeaders);
    }

    // --------------------------------------------------------------- outcome
    // Read-only recovery path. If the kiosk lost the SALE response, it polls
    // here for the outcome the backend already stored for this transaction.
    if (action === "outcome") {
      const { data: sessionRow } = await supabase
        .from("apex_terminal_sessions")
        .select("transaction_id, state, result")
        .eq("kiosk_id", kioskId)
        .maybeSingle();

      // Cancelled / unknown sessions are owned by the cancellation path, so
      // only real terminal outcomes are handed back to a polling kiosk.
      const finishedStates = ["approved", "declined", "failed"];

      const matches = sessionRow?.transaction_id === transactionId;
      const finished = matches && finishedStates.includes(String(sessionRow?.state || ""));
      return json({
        success: true,
        finished,
        state: matches ? sessionRow?.state ?? "missing" : "missing",
        result: finished ? sessionRow?.result ?? null : null,
      }, 200, corsHeaders);
    }


    // ---------------------------------------------------------------- cancel
    if (action === "cancel") {
      const { data: ownershipRows, error: ownershipError } = await supabase.rpc(
        "request_apex_terminal_cancellation",
        { _kiosk_id: kioskId, _transaction_id: transactionId },
      );
      if (ownershipError) throw ownershipError;
      const ownership = Array.isArray(ownershipRows) ? ownershipRows[0] : null;
      if (ownership?.allowed !== true) {
        const alreadyFinished = ["approved", "declined", "failed", "cancelled"].includes(String(ownership?.session_state || ""));
        return json({
          success: alreadyFinished,
          cancelled: ownership?.session_state === "cancelled",
          state: ownership?.session_state || "missing",
          error: alreadyFinished
            ? "This payment session has already finished."
            : "This cancellation does not own the active terminal session.",
        }, 200, corsHeaders);
      }

      const outcome = await cancelAtTerminal();
      await supabase.rpc("finish_apex_terminal_session", {
        _kiosk_id: kioskId,
        _transaction_id: transactionId,
        _state: outcome.cancelled ? "cancelled" : "unknown",
        _result: { success: outcome.cancelled, cancelled: outcome.cancelled, error: outcome.error || null },
      });
      console.log("ApexECR cancel", { correlationId, tid: config.tid, cancelled: outcome.cancelled });
      return json({ success: outcome.cancelled, cancelled: outcome.cancelled, error: outcome.error }, 200, corsHeaders);
    }

    const invoiceNumber = invoiceNumberFor(transactionId);

    // --------------------------------------------------------------- enquiry
    if (action === "enquiry") {
      const result = await callApexEcr(
        config,
        buildEnquiryByRefEnvelope(config, invoiceNumber, String(body?.rrn || ""), String(body?.authCode || ""), transactionId),
        APEX_SOAP_ACTIONS.enquiryByRef,
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

    const leaseSeconds = Math.min(300, Math.max(30, Number(config.timeoutSeconds || 90) + 30));
    const { data: acquisitionRows, error: acquisitionError } = await supabase.rpc(
      "acquire_apex_terminal_session",
      {
        _kiosk_id: kioskId,
        _terminal_id: config.tid,
        _transaction_id: transactionId,
        _lease_seconds: leaseSeconds,
      },
    );
    if (acquisitionError) throw acquisitionError;
    const acquisition = (Array.isArray(acquisitionRows) ? acquisitionRows[0] : null) as TerminalAcquisition | null;
    if (!acquisition) throw new Error("Unable to coordinate the terminal session.");

    if (acquisition.acquisition === "completed" && acquisition.stored_result) {
      return json(acquisition.stored_result, 200, corsHeaders);
    }
    if (acquisition.acquisition === "duplicate_active") {
      return json({
        success: false,
        approved: false,
        failureType: "session_in_progress",
        outcomeUnknown: true,
        error: "This payment request is already being processed by the terminal.",
      }, 200, corsHeaders);
    }
    if (acquisition.acquisition === "busy") {
      return json({
        success: false,
        approved: false,
        failureType: "terminal_busy",
        outcomeUnknown: true,
        error: "The terminal is completing the previous payment. Please wait for it to return to the idle screen.",
      }, 200, corsHeaders);
    }
    if (acquisition.acquisition === "stale_recovery") {
      console.warn("ApexECR expired session recovery", { correlationId, tid: config.tid });
      const recovered = await cancelAtTerminal();
      if (!recovered.cancelled) {
        await supabase.rpc("finish_apex_terminal_session", {
          _kiosk_id: kioskId,
          _transaction_id: acquisition.owner_transaction_id,
          _state: "unknown",
          _result: { success: false, approved: false, failureType: "stale_session", outcomeUnknown: true, error: recovered.error || "Unable to clear the expired terminal session." },
        });
        return json({ success: false, approved: false, failureType: "stale_session", outcomeUnknown: true, error: recovered.error || "Unable to clear the expired terminal session." }, 200, corsHeaders);
      }
      const { data: activated, error: activationError } = await supabase.rpc(
        "activate_recovered_apex_session",
        { _kiosk_id: kioskId, _transaction_id: transactionId, _lease_seconds: leaseSeconds },
      );
      if (activationError || activated !== true) {
        return json({ success: false, approved: false, failureType: "terminal_busy", outcomeUnknown: true, error: "The terminal session changed during recovery. Please wait before trying again." }, 200, corsHeaders);
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    const saleDispatchStartedAt = Date.now();
    console.log("ApexECR sale dispatch", {
      correlationId,
      tid: config.tid,
      configLookupMs: saleDispatchStartedAt - configLookupStartedAt,
      requestToDispatchMs: saleDispatchStartedAt - requestStartedAt,
    });
    let saleResult: ApexEcrResult;
    try {
      saleResult = await callApexEcr(
        config,
        buildSaleEnvelope(config, {
          amount: baisasToDecimalString(amount),
          invoiceNumber,
          referenceNumber: transactionId,
        }),
        APEX_SOAP_ACTIONS.sale,
      );
    } catch (saleError) {
      const message = saleError instanceof Error ? saleError.message : "Terminal request failed.";
      const responseBody = { success: false, approved: false, timedOut: /abort/i.test(message), outcomeUnknown: true, failureType: "terminal_timeout", error: /abort/i.test(message) ? "The terminal did not respond in time." : message };
      await supabase.rpc("finish_apex_terminal_session", { _kiosk_id: kioskId, _transaction_id: transactionId, _state: "unknown", _result: responseBody });
      return json(responseBody, 200, corsHeaders);
    }

    console.log("ApexECR sale response", {
      correlationId,
      tid: config.tid,
      afsRoundTripMs: Date.now() - saleDispatchStartedAt,
      totalMs: Date.now() - requestStartedAt,
      webResponseStatus: saleResult.webResponseStatus,
      posRespStatus: saleResult.posRespStatus,
    });



    // The database lease proves no current app request owns this TID. A busy
    // response here can therefore only be an Apex-side orphan predating the
    // lease; clear that orphan and retry this SALE exactly once.
    const initialError = safeApexError(saleResult);
    if (
      !isSuccessfulWebResponse(saleResult.webResponseStatus) &&
      isAnotherTransactionInProgress(initialError)
    ) {
      console.warn("ApexECR stale session detected", { correlationId, tid: config.tid });
      const cancellation = await cancelAtTerminal();
      console.log("ApexECR stale session cancellation", {
        correlationId,
        tid: config.tid,
        cancelled: cancellation.cancelled,
        error: cancellation.error,
      });

      if (cancellation.cancelled) {
        // Give the terminal a short state-transition window; this is only paid
        // on stale-session recovery and never slows the normal SALE path.
        await new Promise((resolve) => setTimeout(resolve, 350));
        saleResult = await callApexEcr(
          config,
          buildSaleEnvelope(config, {
            amount: baisasToDecimalString(amount),
            invoiceNumber,
            referenceNumber: transactionId,
          }),
          APEX_SOAP_ACTIONS.sale,
        );
      }
    }
    console.log("ApexECR sale response", {
      correlationId,
      tid: config.tid,
      dispatchToResponseMs: Date.now() - saleDispatchStartedAt,
      approved: saleResult.approved,
      webResponseStatus: saleResult.webResponseStatus,
      webResponseErrorDesc: saleResult.webResponseErrorDesc,
      posRespStatus: saleResult.posRespStatus,
      posRespCode: saleResult.posRespCode,
      posRespText: saleResult.posRespText,
    });

    if (!isSuccessfulWebResponse(saleResult.webResponseStatus)) {
      const failureType = classifyFailure(saleResult);
      const apexError = safeApexError(saleResult);
      console.error("ApexECR request failed", {
        correlationId,
        operation: "Sale",
        failureType,
        httpStatus: saleResult.httpStatus,
        contentType: saleResult.contentType,
        elapsedMs: saleResult.elapsedMs,
        webResponseStatus: saleResult.webResponseStatus,
        error: apexError,
      });
      const responseBody = {
          success: false,
          approved: false,
          invoiceNumber,
          correlationId,
          failureType,
          outcomeUnknown: failureType === "afs_network_block" || failureType === "afs_http_error",
          error: failureType === "afs_network_block"
            ? "AFS received the request but its gateway timed out (HTTP 522). Please ask AFS/Ahli Bank to allow and route cloud SOAP POST requests to ApexECR."
            : apexError,
          diagnostics: {
            httpStatus: saleResult.httpStatus ?? null,
            contentType: saleResult.contentType ?? null,
            faultCode: saleResult.faultCode || null,
            faultMessage: saleResult.faultMessage || null,
            elapsedMs: saleResult.elapsedMs ?? null,
            webResponseStatus: saleResult.webResponseStatus || null,
            webResponseErrorDesc: saleResult.webResponseErrorDesc || null,
            posRespStatus: saleResult.posRespStatus || null,
            posRespCode: saleResult.posRespCode || null,
            posRespText: saleResult.posRespText || null,
          },
        };
      await supabase.rpc("finish_apex_terminal_session", {
        _kiosk_id: kioskId,
        _transaction_id: transactionId,
        _state: responseBody.outcomeUnknown ? "unknown" : "failed",
        _result: responseBody,
      });
      return json(responseBody, 200, corsHeaders);
    }

    // Ambiguous approval: AFS accepted the request but the terminal-level
    // fields do not clearly say approved. Ask the terminal's own record
    // (EnquiryByRef) before telling the donor the payment failed.
    if (!saleResult.approved) {
      console.warn("ApexECR non-approved sale reply", {
        correlationId,
        tid: config.tid,
        posRespStatus: saleResult.posRespStatus || null,
        posRespCode: saleResult.posRespCode || null,
        posRespText: saleResult.posRespText || null,
        posRRN: saleResult.posRRN || null,
        posAuthCode: saleResult.posAuthCode || null,
        raw: redactApexRaw(saleResult.raw),
      });

      const clearlyDeclined = ["0", "-1", "false", "declined", "decline"]
        .includes(String(saleResult.posRespStatus || "").trim().toLowerCase())
        && !saleResult.posAuthCode && !saleResult.posRRN;

      if (!clearlyDeclined) {
        try {
          const enquiry = await callApexEcr(
            config,
            buildEnquiryByRefEnvelope(
              config,
              invoiceNumber,
              saleResult.posRRN || "",
              saleResult.posAuthCode || "",
              transactionId,
            ),
            APEX_SOAP_ACTIONS.enquiryByRef,
            15000,
          );
          const enquiryApproved = isSuccessfulWebResponse(enquiry.webResponseStatus) && isApprovedPosResponse(
            enquiry.posRespStatus,
            enquiry.posRespCode,
            enquiry.posAuthCode,
            enquiry.posRRN,
            enquiry.posRespText,
          );
          console.log("ApexECR outcome enquiry", {
            correlationId,
            tid: config.tid,
            enquiryApproved,
            posRespStatus: enquiry.posRespStatus || null,
            posRespCode: enquiry.posRespCode || null,
          });
          if (enquiryApproved) {
            saleResult = {
              ...saleResult,
              approved: true,
              posRespStatus: enquiry.posRespStatus || saleResult.posRespStatus,
              posRespCode: enquiry.posRespCode || saleResult.posRespCode,
              posRespText: enquiry.posRespText || saleResult.posRespText,
              posRRN: enquiry.posRRN || saleResult.posRRN,
              posAuthCode: enquiry.posAuthCode || saleResult.posAuthCode,
              posPan: enquiry.posPan || saleResult.posPan,
              posIssuerName: enquiry.posIssuerName || saleResult.posIssuerName,
            };
          }
        } catch (enquiryError) {
          console.warn("ApexECR outcome enquiry failed", {
            correlationId,
            error: enquiryError instanceof Error ? enquiryError.message : "unknown",
          });
        }
      }
    }



    // Record the transaction through the existing pipeline so reporting,
    // reference numbers and receipts behave exactly as they do today.
    // Admin connection tests take the identical terminal path but are never
    // stored as donations.
    const testMode = body?.testMode === true;
    const internalToken = Deno.env.get("INTERNAL_PAYMENT_TOKEN") ?? "";
    let referenceNumber: string | null = null;

    try {
      if (testMode) throw new Error("skip-recording");

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
      if (!testMode) console.error("Failed to record hardware POS transaction:", recordError);
    }


    const responseBody = {
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
      };
    await supabase.rpc("finish_apex_terminal_session", {
      _kiosk_id: kioskId,
      _transaction_id: transactionId,
      _state: saleResult.approved ? "approved" : "declined",
      _result: responseBody,
    });
    return json(responseBody, 200, corsHeaders);
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
