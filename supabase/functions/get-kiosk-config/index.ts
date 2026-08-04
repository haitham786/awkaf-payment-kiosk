import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stripSensitiveConfig(configRaw: unknown) {
  const config = configRaw && typeof configRaw === "object" ? { ...(configRaw as Record<string, unknown>) } : {};

  if (config.soft_pos && typeof config.soft_pos === "object") {
    const softPos = { ...(config.soft_pos as Record<string, unknown>) };
    delete softPos.auth_key;
    delete softPos.authKey;
    config.soft_pos = softPos;
  }

  if (config.hardware_pos && typeof config.hardware_pos === "object") {
    const hardware = { ...(config.hardware_pos as Record<string, unknown>) };
    delete hardware.secure_key;
    delete hardware.secureKey;
    delete hardware.service_url;
    delete hardware.mid;
    delete hardware.tid;
    config.hardware_pos = hardware;
  }

  return config;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kioskId, includeSoftPosSecret } = await req.json();

    if (typeof kioskId !== "string" || !UUID_REGEX.test(kioskId)) {
      return new Response(JSON.stringify({ error: "Invalid kiosk" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: kiosk, error: kioskError } = await supabase
      .from("kiosks")
      .select("id, status, configuration, reference_number")
      .eq("id", kioskId)
      .maybeSingle();

    if (kioskError) {
      console.error("Failed to load kiosk config");
      return new Response(JSON.stringify({ error: "Unable to load kiosk" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!kiosk) {
      return new Response(JSON.stringify({ kiosk: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configuration = stripSensitiveConfig(kiosk.configuration);

    if (includeSoftPosSecret === true) {
      const { data: secret } = await supabase
        .from("kiosk_secrets")
        .select("soft_pos_auth_key")
        .eq("kiosk_id", kioskId)
        .maybeSingle();

      if (configuration.soft_pos && typeof configuration.soft_pos === "object") {
        configuration.soft_pos = {
          ...(configuration.soft_pos as Record<string, unknown>),
          auth_key: secret?.soft_pos_auth_key || "",
        };
      }
    }

    return new Response(
      JSON.stringify({
        kiosk: {
          id: kiosk.id,
          status: kiosk.status,
          reference_number: kiosk.reference_number,
          configuration,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected kiosk config error");
    return new Response(JSON.stringify({ error: "Unable to load kiosk" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});