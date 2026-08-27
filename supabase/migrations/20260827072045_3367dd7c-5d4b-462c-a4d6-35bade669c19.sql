CREATE TABLE public.apex_terminal_sessions (
  kiosk_id uuid PRIMARY KEY REFERENCES public.kiosks(id) ON DELETE CASCADE,
  terminal_id text NOT NULL,
  transaction_id uuid NOT NULL,
  pending_transaction_id uuid,
  state text NOT NULL CHECK (state IN ('active', 'recovering', 'cancelling', 'approved', 'declined', 'failed', 'cancelled', 'unknown')),
  lease_expires_at timestamptz NOT NULL,
  cancel_requested boolean NOT NULL DEFAULT false,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.apex_terminal_sessions TO service_role;

ALTER TABLE public.apex_terminal_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX apex_terminal_sessions_terminal_id_idx ON public.apex_terminal_sessions (terminal_id);

CREATE OR REPLACE FUNCTION public.acquire_apex_terminal_session(
  _kiosk_id uuid,
  _terminal_id text,
  _transaction_id uuid,
  _lease_seconds integer DEFAULT 120
)
RETURNS TABLE (
  acquisition text,
  owner_transaction_id uuid,
  session_state text,
  stored_result jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_session public.apex_terminal_sessions%ROWTYPE;
  bounded_lease integer := LEAST(GREATEST(_lease_seconds, 30), 300);
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;

  SELECT * INTO current_session
  FROM public.apex_terminal_sessions
  WHERE kiosk_id = _kiosk_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.apex_terminal_sessions (
      kiosk_id, terminal_id, transaction_id, state, lease_expires_at
    ) VALUES (
      _kiosk_id, _terminal_id, _transaction_id, 'active', now() + make_interval(secs => bounded_lease)
    );
    RETURN QUERY SELECT 'acquired'::text, _transaction_id, 'active'::text, NULL::jsonb;
    RETURN;
  END IF;

  IF current_session.transaction_id = _transaction_id THEN
    IF current_session.state IN ('approved', 'declined', 'failed', 'cancelled', 'unknown') THEN
      RETURN QUERY SELECT 'completed'::text, current_session.transaction_id, current_session.state, current_session.result;
    ELSE
      RETURN QUERY SELECT 'duplicate_active'::text, current_session.transaction_id, current_session.state, current_session.result;
    END IF;
    RETURN;
  END IF;

  IF current_session.state IN ('approved', 'declined', 'failed', 'cancelled') THEN
    UPDATE public.apex_terminal_sessions
    SET terminal_id = _terminal_id,
        transaction_id = _transaction_id,
        pending_transaction_id = NULL,
        state = 'active',
        lease_expires_at = now() + make_interval(secs => bounded_lease),
        cancel_requested = false,
        result = NULL,
        updated_at = now()
    WHERE kiosk_id = _kiosk_id;
    RETURN QUERY SELECT 'acquired'::text, _transaction_id, 'active'::text, NULL::jsonb;
    RETURN;
  END IF;

  IF current_session.lease_expires_at <= now() THEN
    UPDATE public.apex_terminal_sessions
    SET state = 'recovering',
        pending_transaction_id = _transaction_id,
        cancel_requested = true,
        lease_expires_at = now() + make_interval(secs => 30),
        updated_at = now()
    WHERE kiosk_id = _kiosk_id;
    RETURN QUERY SELECT 'stale_recovery'::text, current_session.transaction_id, 'recovering'::text, current_session.result;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'busy'::text, current_session.transaction_id, current_session.state, current_session.result;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_apex_terminal_session(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_apex_terminal_session(uuid, text, uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_recovered_apex_session(
  _kiosk_id uuid,
  _transaction_id uuid,
  _lease_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed integer;
  bounded_lease integer := LEAST(GREATEST(_lease_seconds, 30), 300);
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;

  UPDATE public.apex_terminal_sessions
  SET transaction_id = _transaction_id,
      pending_transaction_id = NULL,
      state = 'active',
      lease_expires_at = now() + make_interval(secs => bounded_lease),
      cancel_requested = false,
      result = NULL,
      updated_at = now()
  WHERE kiosk_id = _kiosk_id
    AND state = 'recovering'
    AND pending_transaction_id = _transaction_id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_recovered_apex_session(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_recovered_apex_session(uuid, uuid, integer) TO service_role;

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
  SET state = 'cancelling', cancel_requested = true,
      lease_expires_at = now() + interval '30 seconds', updated_at = now()
  WHERE kiosk_id = _kiosk_id AND transaction_id = _transaction_id;
  RETURN QUERY SELECT true, 'cancelling'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.request_apex_terminal_cancellation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_apex_terminal_cancellation(uuid, uuid) TO service_role;

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
  WHERE kiosk_id = _kiosk_id AND transaction_id = _transaction_id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_apex_terminal_session(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_apex_terminal_session(uuid, uuid, text, jsonb) TO service_role;