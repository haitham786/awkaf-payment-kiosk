-- 1. Treat 'unknown' as a finished state for a different transaction, so a new sale is never blocked by an enquired/unknown prior session.
CREATE OR REPLACE FUNCTION public.acquire_apex_terminal_session(_kiosk_id uuid, _terminal_id text, _transaction_id uuid, _lease_seconds integer DEFAULT 120)
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

  IF current_session.state IN ('approved', 'declined', 'failed', 'rejected', 'cancelled', 'unknown') THEN
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

-- 2. Per-kiosk invoice sequencing (collision-free replacement for the random 6-digit hash).
CREATE TABLE public.apex_invoice_sequences (
  kiosk_id uuid PRIMARY KEY REFERENCES public.kiosks(id) ON DELETE CASCADE,
  next_value bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.apex_invoice_sequences TO service_role;
ALTER TABLE public.apex_invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.apex_invoice_map (
  transaction_id uuid PRIMARY KEY,
  kiosk_id uuid NOT NULL REFERENCES public.kiosks(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.apex_invoice_map TO service_role;
ALTER TABLE public.apex_invoice_map ENABLE ROW LEVEL SECURITY;
CREATE INDEX apex_invoice_map_kiosk_invoice_idx ON public.apex_invoice_map (kiosk_id, invoice_number);

CREATE OR REPLACE FUNCTION public.apex_invoice_for(_kiosk_id uuid, _transaction_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing text;
  seq bigint;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'backend access required';
  END IF;

  SELECT invoice_number INTO existing
  FROM public.apex_invoice_map
  WHERE transaction_id = _transaction_id;
  IF FOUND THEN
    RETURN existing;
  END IF;

  INSERT INTO public.apex_invoice_sequences (kiosk_id, next_value)
  VALUES (_kiosk_id, 2)
  ON CONFLICT (kiosk_id)
  DO UPDATE SET next_value = public.apex_invoice_sequences.next_value + 1,
                updated_at = now()
  RETURNING next_value - 1 INTO seq;

  INSERT INTO public.apex_invoice_map (transaction_id, kiosk_id, invoice_number)
  VALUES (_transaction_id, _kiosk_id, lpad(seq::text, 6, '0'))
  ON CONFLICT (transaction_id) DO NOTHING
  RETURNING invoice_number INTO existing;

  IF existing IS NULL THEN
    SELECT invoice_number INTO existing
    FROM public.apex_invoice_map
    WHERE transaction_id = _transaction_id;
  END IF;

  RETURN existing;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apex_invoice_for(uuid, uuid) FROM public, anon, authenticated;

-- 3. POS diagnostics: one row per dispatch attempt for failure forensics.
CREATE TABLE public.pos_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid,
  correlation_id uuid,
  kiosk_id uuid,
  amount_baisas integer,
  invoice_number text,
  dispatched boolean,
  dispatch_attempts integer,
  outcome text,
  failure_type text,
  http_status integer,
  web_response_status text,
  web_response_error text,
  pos_resp_status text,
  pos_resp_code text,
  session_state_before text,
  seconds_since_previous_attempt numeric,
  request_to_dispatch_ms integer,
  afs_round_trip_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pos_diagnostics TO authenticated;
GRANT ALL ON public.pos_diagnostics TO service_role;
ALTER TABLE public.pos_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read pos diagnostics"
ON public.pos_diagnostics
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX pos_diagnostics_created_idx ON public.pos_diagnostics (created_at DESC);
CREATE INDEX pos_diagnostics_kiosk_idx ON public.pos_diagnostics (kiosk_id, created_at DESC);