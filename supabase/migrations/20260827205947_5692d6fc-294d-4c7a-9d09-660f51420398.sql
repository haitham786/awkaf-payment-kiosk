CREATE OR REPLACE FUNCTION public.claim_stale_apex_session(_kiosk_id uuid, _transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changed integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;

  UPDATE public.apex_terminal_sessions
  SET state = 'recovering',
      cancel_requested = true,
      lease_expires_at = now() + interval '30 seconds',
      updated_at = now()
  WHERE kiosk_id = _kiosk_id
    AND transaction_id = _transaction_id
    AND state IN ('active', 'cancelling', 'recovering')
    AND lease_expires_at <= now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_stale_apex_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stale_apex_session(uuid, uuid) TO service_role;