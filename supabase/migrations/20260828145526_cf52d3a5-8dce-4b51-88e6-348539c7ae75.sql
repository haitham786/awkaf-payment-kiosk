ALTER TABLE public.apex_terminal_sessions
  ADD COLUMN IF NOT EXISTS cancel_cooldown_until timestamp with time zone;

CREATE OR REPLACE FUNCTION public.mark_apex_cancel_dispatched(_kiosk_id uuid, _cooldown_ms integer DEFAULT 900)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;

  UPDATE public.apex_terminal_sessions
  SET cancel_cooldown_until = now() + make_interval(secs => LEAST(GREATEST(_cooldown_ms, 0), 5000) / 1000.0),
      updated_at = now()
  WHERE kiosk_id = _kiosk_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.acquire_apex_terminal_session(uuid, text, uuid, integer);
CREATE FUNCTION public.acquire_apex_terminal_session(_kiosk_id uuid, _terminal_id text, _transaction_id uuid, _lease_seconds integer DEFAULT 120)
RETURNS TABLE(acquisition text, owner_transaction_id uuid, session_state text, stored_result jsonb, cancel_cooldown_until timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    RETURN QUERY SELECT 'acquired'::text, _transaction_id, 'active'::text, NULL::jsonb, NULL::timestamptz;
    RETURN;
  END IF;

  IF current_session.transaction_id = _transaction_id THEN
    IF current_session.state IN ('approved', 'declined', 'failed', 'rejected', 'cancelled', 'unknown') THEN
      RETURN QUERY SELECT 'completed'::text, current_session.transaction_id, current_session.state, current_session.result, current_session.cancel_cooldown_until;
    ELSE
      RETURN QUERY SELECT 'duplicate_active'::text, current_session.transaction_id, current_session.state, current_session.result, current_session.cancel_cooldown_until;
    END IF;
    RETURN;
  END IF;

  IF current_session.state IN ('approved', 'declined', 'failed', 'rejected', 'cancelled') THEN
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
    RETURN QUERY SELECT 'acquired'::text, _transaction_id, 'active'::text, NULL::jsonb, current_session.cancel_cooldown_until;
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
    RETURN QUERY SELECT 'stale_recovery'::text, current_session.transaction_id, 'recovering'::text, current_session.result, current_session.cancel_cooldown_until;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'busy'::text, current_session.transaction_id, current_session.state, current_session.result, current_session.cancel_cooldown_until;
END;
$function$;

DROP FUNCTION IF EXISTS public.begin_apex_sale(uuid, uuid, integer);
CREATE FUNCTION public.begin_apex_sale(_kiosk_id uuid, _transaction_id uuid, _lease_seconds integer DEFAULT 120)
RETURNS TABLE(kiosk_status text, configuration jsonb, secure_key text, acquisition text, owner_transaction_id uuid, session_state text, stored_result jsonb, cancel_cooldown_until timestamp with time zone)
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
    RETURN QUERY SELECT 'missing'::text, NULL::jsonb, NULL::text, 'skipped'::text, NULL::uuid, NULL::text, NULL::jsonb, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT ks.apex_secure_key INTO skey
  FROM public.kiosk_secrets ks WHERE ks.kiosk_id = _kiosk_id;

  tid := COALESCE(k.configuration->'hardware_pos'->>'tid', '');

  IF k.status <> 'active' OR tid = '' OR COALESCE(skey, '') = '' THEN
    RETURN QUERY SELECT k.status::text, k.configuration, skey, 'skipped'::text, NULL::uuid, NULL::text, NULL::jsonb, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO acq
  FROM public.acquire_apex_terminal_session(_kiosk_id, tid, _transaction_id, _lease_seconds);

  RETURN QUERY SELECT k.status::text, k.configuration, skey,
    acq.acquisition, acq.owner_transaction_id, acq.session_state, acq.stored_result, acq.cancel_cooldown_until;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finish_apex_terminal_session(_kiosk_id uuid, _transaction_id uuid, _state text, _result jsonb DEFAULT NULL::jsonb)
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
  IF _state NOT IN ('approved', 'declined', 'failed', 'rejected', 'cancelled', 'unknown') THEN
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
$function$;