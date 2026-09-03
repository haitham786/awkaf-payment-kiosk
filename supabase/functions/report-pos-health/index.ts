// Receives OM-A880 terminal health beats from each kiosk, stores the latest
// state per kiosk, appends an audit history row on every state change and
// raises de-duplicated outage / recovery alerts.
// Payment path is untouched: this endpoint never talks to the terminal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const VALID_STATES = new Set(["ready", "attention", "not_responding", "offline", "unknown"]);
const ALERT_STATES = new Set(["offline", "not_responding", "attention"]);
const DEFAULT_ISMART_URL = "https://www.ismartsms.net/iBulkSMS/HttpWS/SMSDynamicRefIntlAPI.aspx";

type Supa = ReturnType<typeof createClient>;

function inQuietHours(startHour: number | null, endHour: number | null): boolean {
  if (startHour === null || endHour === null) return false;
  // Oman is UTC+4 (no DST).
  const hour = (new Date().getUTCHours() + 4) % 24;
  if (startHour === endHour) return false;
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

async function sendSmsAlert(supabase: Supa, recipients: string[], text: string) {
  const { data: sms } = await supabase.from("sms_settings").select("*").limit(1).maybeSingle();
  const url = (sms?.api_endpoint && String(sms.api_endpoint).trim()) || DEFAULT_ISMART_URL;
  const userId = sms?.api_username?.trim();
  const password = sms?.api_password?.trim();
  const header = (sms?.sender_id || "").trim().slice(0, 11);
  if (!userId || !password || !header) {
    console.warn("[report-pos-health] SMS gateway not configured — alert not sent");
    return;
  }

  for (const raw of recipients) {
    const digits = String(raw).replace(/\D/g, "");
    if (!digits) continue;
    const mobile = digits.startsWith("968") ? digits : `968${digits}`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          UserId: userId,
          Password: password,
          MobileNo: mobile,
          Message: text,
          Lang: "1",
          Header: header,
          referenceIds: String(Date.now()).slice(-6),
        }).toString(),
      });
    } catch (err) {
      console.error("[report-pos-health] alert send failed", err);
    }
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const kioskId: string | undefined = body?.kioskId;
    const state: string = VALID_STATES.has(body?.state) ? body.state : "offline";

    if (!kioskId) {
      return new Response(JSON.stringify({ error: "kioskId is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: previous } = await supabase
      .from("kiosk_pos_status")
      .select("state, alerted_state, state_since")
      .eq("kiosk_id", kioskId)
      .maybeSingle();

    const previousState: string | null = previous?.state ?? null;
    const changed = previousState !== state;
    const nowIso = new Date().toISOString();

    const { error } = await supabase.from("kiosk_pos_status").upsert(
      {
        kiosk_id: kioskId,
        state,
        transport_connected: body?.transportConnected === true,
        responded: body?.responded === true,
        printer_status: body?.printerStatus ?? null,
        reader_status: body?.readerStatus ?? null,
        paper_ok: typeof body?.paperOk === "boolean" ? body.paperOk : null,
        battery_ok: typeof body?.batteryOk === "boolean" ? body.batteryOk : null,
        error_code: body?.errorCode ?? null,
        message: body?.message ?? null,
        terminal_label: body?.terminalLabel ?? null,
        tid: body?.tid ?? null,
        serial_number: body?.serialNumber ?? null,
        firmware_version: body?.firmwareVersion ?? null,
        app_version: body?.appVersion ?? null,
        connection_info: body?.connectionInfo ?? null,
        state_since: changed ? nowIso : (previous?.state_since ?? nowIso),
        updated_at: nowIso,
      },
      { onConflict: "kiosk_id" },
    );

    if (error) throw error;

    // Append-only audit history — one row per state change.
    if (changed) {
      await supabase.from("kiosk_pos_status_history").insert({
        kiosk_id: kioskId,
        state,
        previous_state: previousState,
        message: body?.message ?? null,
        error_code: body?.errorCode ?? null,
        paper_ok: typeof body?.paperOk === "boolean" ? body.paperOk : null,
        battery_ok: typeof body?.batteryOk === "boolean" ? body.batteryOk : null,
        transport_connected: body?.transportConnected === true,
        responded: body?.responded === true,
      });
    }

    // Alerting — one alert per outage, plus one recovery notice (de-duplicated
    // through alerted_state so repeated heartbeats never re-notify).
    if (changed) {
      const { data: settings } = await supabase.from("pos_alert_settings").select("*").limit(1).maybeSingle();
      const recipients: string[] = Array.isArray(settings?.recipients) ? settings!.recipients : [];
      const enabled = settings?.enabled !== false && recipients.length > 0;
      const alertOnAttention = settings?.alert_on_attention !== false;
      const alerted = previous?.alerted_state ?? null;

      if (enabled && !inQuietHours(settings?.quiet_hours_start ?? null, settings?.quiet_hours_end ?? null)) {
        const { data: kiosk } = await supabase.from("kiosks").select("name, location").eq("id", kioskId).maybeSingle();
        const who = `${kiosk?.name ?? "Kiosk"}${kiosk?.location ? ` (${kiosk.location})` : ""}`;
        const shouldAlert = ALERT_STATES.has(state) && (state !== "attention" || alertOnAttention);

        if (shouldAlert && alerted !== state) {
          const label =
            state === "offline" ? "OFFLINE" : state === "not_responding" ? "NOT RESPONDING" : "NEEDS ATTENTION";
          await sendSmsAlert(
            supabase,
            recipients,
            `Awkaf POS alert: ${who} terminal is ${label}. ${body?.message ?? ""}`.trim(),
          );
          await supabase
            .from("kiosk_pos_status")
            .update({ alerted_state: state, alerted_at: nowIso })
            .eq("kiosk_id", kioskId);
        } else if (state === "ready" && alerted && alerted !== "ready") {
          await sendSmsAlert(supabase, recipients, `Awkaf POS recovery: ${who} terminal is back online and Ready.`);
          await supabase
            .from("kiosk_pos_status")
            .update({ alerted_state: null, alerted_at: nowIso })
            .eq("kiosk_id", kioskId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, changed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[report-pos-health]", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
