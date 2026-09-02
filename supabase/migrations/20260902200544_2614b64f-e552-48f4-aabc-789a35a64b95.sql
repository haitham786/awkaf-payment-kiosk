CREATE TABLE public.kiosk_pos_status (
  kiosk_id uuid PRIMARY KEY REFERENCES public.kiosks(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'offline',
  transport_connected boolean NOT NULL DEFAULT false,
  responded boolean NOT NULL DEFAULT false,
  printer_status text,
  reader_status text,
  paper_ok boolean,
  battery_ok boolean,
  error_code text,
  message text,
  terminal_label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kiosk_pos_status TO authenticated;
GRANT ALL ON public.kiosk_pos_status TO service_role;

ALTER TABLE public.kiosk_pos_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view POS health"
ON public.kiosk_pos_status FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));