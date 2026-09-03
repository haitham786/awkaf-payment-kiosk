ALTER TABLE public.kiosk_pos_status
  ADD COLUMN IF NOT EXISTS tid text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS firmware_version text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS connection_info text,
  ADD COLUMN IF NOT EXISTS last_transaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_transaction_result text,
  ADD COLUMN IF NOT EXISTS alerted_state text,
  ADD COLUMN IF NOT EXISTS alerted_at timestamptz,
  ADD COLUMN IF NOT EXISTS state_since timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.kiosk_pos_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id uuid NOT NULL REFERENCES public.kiosks(id) ON DELETE CASCADE,
  state text NOT NULL,
  previous_state text,
  message text,
  error_code text,
  paper_ok boolean,
  battery_ok boolean,
  transport_connected boolean,
  responded boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiosk_pos_status_history_kiosk_time ON public.kiosk_pos_status_history (kiosk_id, created_at DESC);

GRANT SELECT ON public.kiosk_pos_status_history TO authenticated;
GRANT ALL ON public.kiosk_pos_status_history TO service_role;
ALTER TABLE public.kiosk_pos_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view POS health history" ON public.kiosk_pos_status_history;
CREATE POLICY "Admins can view POS health history"
ON public.kiosk_pos_status_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.pos_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  channel text NOT NULL DEFAULT 'sms',
  recipients text[] NOT NULL DEFAULT '{}',
  offline_threshold_seconds integer NOT NULL DEFAULT 180,
  alert_on_attention boolean NOT NULL DEFAULT true,
  quiet_hours_start integer,
  quiet_hours_end integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pos_alert_settings TO authenticated;
GRANT ALL ON public.pos_alert_settings TO service_role;
ALTER TABLE public.pos_alert_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage POS alert settings" ON public.pos_alert_settings;
CREATE POLICY "Admins manage POS alert settings"
ON public.pos_alert_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.pos_alert_settings (enabled, channel, recipients)
SELECT true, 'sms', '{}'
WHERE NOT EXISTS (SELECT 1 FROM public.pos_alert_settings);