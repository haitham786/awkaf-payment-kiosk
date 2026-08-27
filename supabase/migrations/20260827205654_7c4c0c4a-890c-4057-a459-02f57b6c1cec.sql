CREATE OR REPLACE FUNCTION public.begin_apex_sale(_kiosk_id uuid, _transaction_id uuid, _lease_seconds integer DEFAULT 120)
RETURNS TABLE(
  kiosk_status text,
  configuration jsonb,
  secure_key text,
  acquisition text,
  owner_transaction_id uuid,
  session_state text,
  stored_result jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  k RECORD;
  skey text;
  tid text;
  acq RECORD;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;

  SELECT ki.status, ki.configuration INTO k
  FROM public.kiosks ki WHERE ki.id = _kiosk_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'missing'::text, NULL::jsonb, NULL::text, 'skipped'::text, NULL::uuid, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  SELECT ks.apex_secure_key INTO skey
  FROM public.kiosk_secrets ks WHERE ks.kiosk_id = _kiosk_id;

  tid := COALESCE(k.configuration->'hardware_pos'->>'tid', '');

  IF k.status <> 'active' OR tid = '' OR COALESCE(skey, '') = '' THEN
    RETURN QUERY SELECT k.status::text, k.configuration, skey, 'skipped'::text, NULL::uuid, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  SELECT * INTO acq
  FROM public.acquire_apex_terminal_session(_kiosk_id, tid, _transaction_id, _lease_seconds);

  RETURN QUERY SELECT k.status::text, k.configuration, skey,
    acq.acquisition, acq.owner_transaction_id, acq.session_state, acq.stored_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_apex_sale(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_apex_sale(uuid, uuid, integer) TO service_role;