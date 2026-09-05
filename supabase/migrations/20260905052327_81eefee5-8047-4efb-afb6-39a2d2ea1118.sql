CREATE OR REPLACE FUNCTION public.report_financial_stats(
  _period text DEFAULT 'daily',
  _kiosk_id uuid DEFAULT NULL,
  _category_reference text DEFAULT NULL,
  _include_test boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tz constant text := 'Asia/Muscat';
  now_local timestamp := (now() AT TIME ZONE tz);
  start_local timestamp;
  start_ts timestamptz;
  day_span integer;
  result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  IF _period = 'daily' THEN
    start_local := date_trunc('day', now_local);
  ELSIF _period = 'weekly' THEN
    start_local := date_trunc('day', now_local) - make_interval(days => EXTRACT(dow FROM now_local)::int);
  ELSIF _period = 'monthly' THEN
    start_local := date_trunc('month', now_local);
  ELSIF _period = 'yearly' THEN
    start_local := date_trunc('year', now_local);
  ELSE
    start_local := NULL;
  END IF;

  start_ts := CASE WHEN start_local IS NULL THEN NULL ELSE (start_local AT TIME ZONE tz) END;

  WITH scoped AS (
    SELECT t.*
    FROM public.transactions t
    WHERE (start_ts IS NULL OR t.created_at >= start_ts)
      AND (_kiosk_id IS NULL OR t.kiosk_id = _kiosk_id)
      AND (_category_reference IS NULL OR t.category_reference = _category_reference)
      AND (_include_test OR COALESCE(t.payment_method, '') <> 'test_payment')
  ),
  settled AS (
    SELECT * FROM scoped WHERE status IN ('completed', 'refunded', 'reversed')
  ),
  totals AS (
    SELECT
      COALESCE(SUM(amount_baisas) FILTER (WHERE status = 'completed'), 0)::bigint AS gross_baisas,
      COALESCE(SUM(amount_baisas) FILTER (WHERE status IN ('refunded', 'reversed')), 0)::bigint AS refunded_baisas,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
      COUNT(*) FILTER (WHERE status IN ('refunded', 'reversed'))::int AS refunded_count,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_count,
      COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS in_flight_count,
      COUNT(*)::int AS attempts_count
    FROM scoped
  ),
  receipts AS (
    SELECT
      COUNT(*) FILTER (WHERE sms_status = 'sent')::int AS sms_sent,
      COUNT(*) FILTER (WHERE sms_status = 'failed')::int AS sms_failed,
      COUNT(*) FILTER (WHERE COALESCE(sms_status, 'not_sent') NOT IN ('sent', 'failed'))::int AS sms_not_sent,
      COUNT(*) FILTER (WHERE whatsapp_status = 'sent')::int AS wa_sent,
      COUNT(*) FILTER (WHERE whatsapp_status = 'failed')::int AS wa_failed,
      COUNT(*) FILTER (WHERE COALESCE(whatsapp_status, 'not_sent') NOT IN ('sent', 'failed'))::int AS wa_not_sent
    FROM scoped
  ),
  cats AS (
    SELECT
      COALESCE(dc.title, s.category_reference, s.category::text) AS name,
      COALESCE(
        SUM(s.amount_baisas) FILTER (WHERE s.status = 'completed'), 0
      )::bigint
      - COALESCE(
        SUM(s.amount_baisas) FILTER (WHERE s.status IN ('refunded', 'reversed')), 0
      )::bigint AS net_baisas,
      COUNT(*) FILTER (WHERE s.status = 'completed')::int AS count
    FROM settled s
    LEFT JOIN public.donation_categories dc
      ON dc.category_reference = s.category_reference
     OR (s.category_reference IS NULL AND dc.category_id = s.category::text)
    GROUP BY 1
  ),
  bounds AS (
    SELECT
      COALESCE(
        start_local::date,
        (SELECT MIN((created_at AT TIME ZONE tz)::date) FROM settled),
        (now_local - interval '6 days')::date
      ) AS from_day,
      now_local::date AS to_day
  ),
  calendar AS (
    SELECT generate_series(
      GREATEST(from_day, to_day - 89),
      to_day,
      interval '1 day'
    )::date AS day
    FROM bounds
  ),
  per_day AS (
    SELECT
      (created_at AT TIME ZONE tz)::date AS day,
      COALESCE(SUM(amount_baisas) FILTER (WHERE status = 'completed'), 0)::bigint
        - COALESCE(SUM(amount_baisas) FILTER (WHERE status IN ('refunded', 'reversed')), 0)::bigint AS net_baisas,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS count
    FROM settled
    GROUP BY 1
  ),
  attention AS (
    SELECT jsonb_agg(x ORDER BY x->>'created_at') AS rows
    FROM (
      SELECT jsonb_build_object(
        'id', s.id,
        'reference_number', s.reference_number,
        'pos_rrn', s.pos_rrn,
        'status', s.status,
        'amount_baisas', s.amount_baisas,
        'kiosk_id', s.kiosk_id,
        'created_at', s.created_at
      ) AS x
      FROM scoped s
      WHERE s.status IN ('pending', 'processing')
        AND s.created_at < now() - interval '15 minutes'
      ORDER BY s.created_at
      LIMIT 50
    ) q
  )
  SELECT jsonb_build_object(
    'period', _period,
    'period_start', start_ts,
    'timezone', tz,
    'include_test', _include_test,
    'gross_baisas', t.gross_baisas,
    'refunded_baisas', t.refunded_baisas,
    'net_baisas', t.gross_baisas - t.refunded_baisas,
    'completed_count', t.completed_count,
    'refunded_count', t.refunded_count,
    'failed_count', t.failed_count,
    'cancelled_count', t.cancelled_count,
    'in_flight_count', t.in_flight_count,
    'attempts_count', t.attempts_count,
    'success_rate', CASE
      WHEN (t.completed_count + t.failed_count + t.cancelled_count) = 0 THEN NULL
      ELSE ROUND((t.completed_count::numeric * 100) / (t.completed_count + t.failed_count + t.cancelled_count), 1)
    END,
    'receipts', jsonb_build_object(
      'sms', jsonb_build_object('sent', r.sms_sent, 'failed', r.sms_failed, 'not_sent', r.sms_not_sent),
      'whatsapp', jsonb_build_object('sent', r.wa_sent, 'failed', r.wa_failed, 'not_sent', r.wa_not_sent)
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name, 'net_baisas', net_baisas, 'count', count) ORDER BY net_baisas DESC)
      FROM cats WHERE count > 0 OR net_baisas <> 0
    ), '[]'::jsonb),
    'trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'day', c.day,
        'net_baisas', COALESCE(p.net_baisas, 0),
        'count', COALESCE(p.count, 0)
      ) ORDER BY c.day)
      FROM calendar c LEFT JOIN per_day p ON p.day = c.day
    ), '[]'::jsonb),
    'needs_attention', COALESCE((SELECT rows FROM attention), '[]'::jsonb)
  )
  INTO result
  FROM totals t, receipts r;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.report_financial_stats(text, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_financial_stats(text, uuid, text, boolean) TO authenticated, service_role;