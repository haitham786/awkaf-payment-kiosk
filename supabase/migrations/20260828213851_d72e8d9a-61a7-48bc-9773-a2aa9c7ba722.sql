CREATE OR REPLACE FUNCTION public.request_apex_terminal_cancellation(
  _kiosk_id uuid,
  _transaction_id uuid
)
RETURNS TABLE (allowed boolean, session_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_session public.apex_terminal_sessions%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;

  SELECT * INTO current_session
  FROM public.apex_terminal_sessions
  WHERE kiosk_id = _kiosk_id
  FOR UPDATE;

  IF NOT FOUND OR current_session.transaction_id <> _transaction_id THEN
    RETURN QUERY SELECT false, COALESCE(current_session.state, 'missing');
    RETURN;
  END IF;

  IF current_session.state IN ('approved', 'declined', 'failed', 'cancelled') THEN
    RETURN QUERY SELECT false, current_session.state;
    RETURN;
  END IF;

  UPDATE public.apex_terminal_sessions
  SET state = 'cancelling',
      cancel_requested = true,
      updated_at = now()
  WHERE kiosk_id = _kiosk_id AND transaction_id = _transaction_id;

  RETURN QUERY SELECT true, 'cancelling'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.request_apex_terminal_cancellation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_apex_terminal_cancellation(uuid, uuid) TO service_role;