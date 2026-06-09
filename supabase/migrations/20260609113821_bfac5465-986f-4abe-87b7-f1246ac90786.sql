CREATE TABLE IF NOT EXISTS public.kiosk_secrets (
  kiosk_id uuid PRIMARY KEY REFERENCES public.kiosks(id) ON DELETE CASCADE,
  soft_pos_auth_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_secrets TO authenticated;
GRANT ALL ON public.kiosk_secrets TO service_role;

ALTER TABLE public.kiosk_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage kiosk secrets" ON public.kiosk_secrets;
CREATE POLICY "Admins can manage kiosk secrets"
ON public.kiosk_secrets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP TRIGGER IF EXISTS update_kiosk_secrets_updated_at ON public.kiosk_secrets;
CREATE TRIGGER update_kiosk_secrets_updated_at
BEFORE UPDATE ON public.kiosk_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.kiosk_secrets (kiosk_id, soft_pos_auth_key)
SELECT id, configuration #>> '{soft_pos,auth_key}'
FROM public.kiosks
WHERE configuration #>> '{soft_pos,auth_key}' IS NOT NULL
  AND configuration #>> '{soft_pos,auth_key}' <> ''
ON CONFLICT (kiosk_id) DO UPDATE
SET soft_pos_auth_key = EXCLUDED.soft_pos_auth_key,
    updated_at = now();

UPDATE public.kiosks
SET configuration = jsonb_set(
  configuration,
  '{soft_pos}',
  COALESCE(configuration->'soft_pos', '{}'::jsonb) - 'auth_key',
  true
)
WHERE configuration->'soft_pos' ? 'auth_key';

DROP POLICY IF EXISTS "Kiosks can view their own data" ON public.kiosks;
REVOKE SELECT ON public.kiosks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosks TO authenticated;
GRANT ALL ON public.kiosks TO service_role;