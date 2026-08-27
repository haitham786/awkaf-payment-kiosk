CREATE OR REPLACE FUNCTION public.finish_apex_terminal_session(
  _kiosk_id uuid,
  _transaction_id uuid,
  _state text,
  _result jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;
  IF _state NOT IN ('approved', 'declined', 'failed', 'cancelled', 'unknown') THEN
    RAISE EXCEPTION 'invalid terminal state';
  END IF;

  UPDATE public.apex_terminal_sessions
  SET state = _state,
      pending_transaction_id = NULL,
      cancel_requested = (_state = 'cancelled'),
      result = _result,
      lease_expires_at = now(),
      updated_at = now()
  WHERE kiosk_id = _kiosk_id
    AND transaction_id = _transaction_id
    AND (state <> 'cancelled' OR _state = 'cancelled');
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_apex_terminal_session(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_apex_terminal_session(uuid, uuid, text, jsonb) TO service_role;