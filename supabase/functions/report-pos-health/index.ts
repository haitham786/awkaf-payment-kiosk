// Receives OM-A880 terminal health beats from each kiosk and stores the latest
// state per kiosk so the admin panel can render a live indicator.
// Payment path is untouched: this endpoint never talks to the terminal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const VALID_STATES = new Set(["ready", "attention", "not_responding", "offline"]);

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
        updated_at: new Date().toISOString(),
      },
      { onConflict: "kiosk_id" },
    );

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
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
