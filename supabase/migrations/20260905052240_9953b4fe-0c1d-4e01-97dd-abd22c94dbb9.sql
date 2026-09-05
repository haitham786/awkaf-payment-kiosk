ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'reversed';

CREATE TABLE IF NOT EXISTS public.export_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  export_type text NOT NULL DEFAULT 'transactions_csv',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  masked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.export_audit TO authenticated;
GRANT ALL ON public.export_audit TO service_role;

ALTER TABLE public.export_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view export audit"
ON public.export_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can log their exports"
ON public.export_audit FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);