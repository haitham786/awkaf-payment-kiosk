CREATE OR REPLACE FUNCTION public.report_homepage_overview(_trend_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tz constant text := 'Asia/Muscat';
  now_local timestamp := (now() AT TIME ZONE tz);
  today_start date := date_trunc('day', now_local)::date;
  week_start date := (date_trunc('day', now_local) - make_interval(days => EXTRACT(dow FROM now_local)::int))::date;
  month_start date := date_trunc('month', now_local)::date;
  days integer := LEAST(GREATEST(COALESCE(_trend_days, 7), 1), 365);
  result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  WITH base AS (
    SELECT t.*, (t.created_at AT TIME ZONE tz)::date AS day_local
    FROM public.transactions t
    WHERE COALESCE(t.payment_method, '') <> 'test_payment'
  ),
  net AS (
    SELECT day_local,
      COALESCE(SUM(amount_baisas) FILTER (WHERE status = 'completed'), 0)::bigint
        - COALESCE(SUM(amount_baisas) FILTER (WHERE status IN ('refunded','reversed')), 0)::bigint AS net_baisas,
      category_reference, category
    FROM base
    GROUP BY day_local, category_reference, category
  ),
  kpi AS (
    SELECT
      COALESCE(SUM(amount_baisas) FILTER (WHERE status = 'completed'), 0)::bigint
        - COALESCE(SUM(amount_baisas) FILTER (WHERE status IN ('refunded','reversed')), 0)::bigint AS net_baisas,
      COUNT(*)::int AS attempts,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
    FROM base
  ),
  periods AS (
    SELECT
      COALESCE(SUM(net_baisas) FILTER (WHERE day_local >= today_start), 0)::bigint AS today_net,
      COALESCE(SUM(net_baisas) FILTER (WHERE day_local >= today_start - 1 AND day_local < today_start), 0)::bigint AS yesterday_net,
      COALESCE(SUM(net_baisas) FILTER (WHERE day_local >= week_start), 0)::bigint AS week_net,
      COALESCE(SUM(net_baisas) FILTER (WHERE day_local >= week_start - 7 AND day_local < week_start), 0)::bigint AS prev_week_net,
      COALESCE(SUM(net_baisas) FILTER (WHERE day_local >= month_start), 0)::bigint AS month_net,
      COALESCE(SUM(net_baisas) FILTER (WHERE day_local >= (month_start - interval '1 month')::date AND day_local < month_start), 0)::bigint AS prev_month_net
    FROM net
  ),
  calendar AS (
    SELECT generate_series(today_start - (days - 1), today_start, interval '1 day')::date AS day
  ),
  trend AS (
    SELECT c.day, COALESCE(SUM(n.net_baisas), 0)::bigint AS net_baisas
    FROM calendar c LEFT JOIN net n ON n.day_local = c.day
    GROUP BY c.day
  ),
  cause_cur AS (
    SELECT COALESCE(NULLIF(dc.title_en, ''), dc.title, n.category_reference, n.category::text) AS name,
           n.category_reference AS code,
           SUM(n.net_baisas)::bigint AS net_baisas
    FROM net n
    LEFT JOIN public.donation_categories dc
      ON dc.category_reference = n.category_reference
      OR (n.category_reference IS NULL AND dc.category_id = n.category::text)
    WHERE n.day_local >= month_start
    GROUP BY 1, 2
  ),
  cause_prev AS (
    SELECT COALESCE(NULLIF(dc.title_en, ''), dc.title, n.category_reference, n.category::text) AS name,
           SUM(n.net_baisas)::bigint AS net_baisas
    FROM net n
    LEFT JOIN public.donation_categories dc
      ON dc.category_reference = n.category_reference
      OR (n.category_reference IS NULL AND dc.category_id = n.category::text)
    WHERE n.day_local >= (month_start - interval '1 month')::date AND n.day_local < month_start
    GROUP BY 1
  ),
  causes AS (
    SELECT c.name, c.code, c.net_baisas, COALESCE(p.net_baisas, 0)::bigint AS prev_net_baisas
    FROM cause_cur c LEFT JOIN cause_prev p ON p.name = c.name
  ),
  kiosk_counts AS (
    SELECT COUNT(*)::int AS registered,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active
    FROM public.kiosks
  ),
  health AS (
    SELECT k.id, k.name,
      CASE WHEN s.kiosk_id IS NULL THEN 'unknown'
           WHEN s.updated_at < now() - interval '3 minutes' THEN 'offline'
           ELSE s.state END AS state,
      s.updated_at, s.paper_ok, s.battery_ok
    FROM public.kiosks k
    LEFT JOIN public.kiosk_pos_status s ON s.kiosk_id = k.id
  ),
  last_hour AS (
    SELECT COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE status IN ('failed','cancelled'))::int AS failed
    FROM base WHERE created_at >= now() - interval '1 hour'
  ),
  attention AS (
    SELECT
      (SELECT COUNT(*) FROM base WHERE status IN ('pending','processing') AND created_at < now() - interval '10 minutes')::int AS stuck,
      (SELECT COUNT(*) FROM base WHERE day_local >= today_start AND (sms_status = 'failed' OR whatsapp_status = 'failed'))::int AS receipts_failed,
      (SELECT COUNT(*) FROM base WHERE status = 'completed' AND day_local >= today_start AND COALESCE(pos_rrn, '') = '')::int AS unreconciled
  ),
  tgt AS (
    SELECT t.id, t.name, t.scope, t.amount_baisas, t.start_date, t.end_date, t.category_reference,
      COALESCE((
        SELECT SUM(n.net_baisas) FROM net n
        WHERE n.day_local >= t.start_date AND n.day_local <= t.end_date
          AND (t.category_reference IS NULL OR n.category_reference = t.category_reference)
      ), 0)::bigint AS raised_baisas,
      GREATEST((t.end_date - today_start), 0)::int AS days_left
    FROM public.targets t
    WHERE t.active AND t.start_date <= today_start AND t.end_date >= today_start
    ORDER BY t.end_date
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'timezone', tz,
    'generated_at', now(),
    'trend_days', days,
    'kpi', jsonb_build_object(
      'net_baisas', k.net_baisas,
      'attempts', k.attempts,
      'completed', k.completed,
      'failed', k.failed,
      'cancelled', k.cancelled,
      'success_rate', CASE WHEN (k.completed + k.failed + k.cancelled) = 0 THEN NULL
        ELSE ROUND((k.completed::numeric * 100) / (k.completed + k.failed + k.cancelled), 1) END,
      'active_kiosks', kc.active,
      'registered_kiosks', kc.registered
    ),
    'momentum', jsonb_build_object(
      'today', jsonb_build_object('net_baisas', p.today_net, 'previous_baisas', p.yesterday_net),
      'week', jsonb_build_object('net_baisas', p.week_net, 'previous_baisas', p.prev_week_net),
      'month', jsonb_build_object('net_baisas', p.month_net, 'previous_baisas', p.prev_month_net)
    ),
    'target', (SELECT to_jsonb(tgt) FROM tgt),
    'trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', day, 'net_baisas', net_baisas) ORDER BY day) FROM trend), '[]'::jsonb),
    'trend_total_baisas', COALESCE((SELECT SUM(net_baisas) FROM trend), 0),
    'causes', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'code', code, 'net_baisas', net_baisas, 'prev_net_baisas', prev_net_baisas) ORDER BY net_baisas DESC) FROM causes), '[]'::jsonb),
    'causes_total_baisas', COALESCE((SELECT SUM(net_baisas) FROM causes), 0),
    'attention', jsonb_build_object(
      'offline_kiosks', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'state', state, 'last_seen', updated_at)) FROM health WHERE state IN ('offline','not_responding','unknown')), '[]'::jsonb),
      'attention_kiosks', COALESCE((SELECT COUNT(*) FROM health WHERE state = 'attention'), 0),
      'terminal_conditions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'paper_ok', paper_ok, 'battery_ok', battery_ok)) FROM health WHERE paper_ok IS FALSE OR battery_ok IS FALSE), '[]'::jsonb),
      'stuck_count', a.stuck,
      'receipts_failed_today', a.receipts_failed,
      'unreconciled_today', a.unreconciled,
      'last_hour', jsonb_build_object('completed', lh.completed, 'failed', lh.failed)
    )
  ) INTO result
  FROM kpi k, periods p, kiosk_counts kc, attention a, last_hour lh;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.report_homepage_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_homepage_overview(integer) TO authenticated, service_role;