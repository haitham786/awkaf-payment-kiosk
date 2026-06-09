ALTER TABLE public.kiosk_secrets
ADD COLUMN IF NOT EXISTS access_token text NOT NULL DEFAULT gen_random_uuid()::text;

CREATE OR REPLACE FUNCTION public.ensure_kiosk_secret_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kiosk_secrets (kiosk_id)
  VALUES (NEW.id)
  ON CONFLICT (kiosk_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_kiosk_secret_row_after_insert ON public.kiosks;
CREATE TRIGGER ensure_kiosk_secret_row_after_insert
AFTER INSERT ON public.kiosks
FOR EACH ROW
EXECUTE FUNCTION public.ensure_kiosk_secret_row();

INSERT INTO public.kiosk_secrets (kiosk_id)
SELECT id
FROM public.kiosks
ON CONFLICT (kiosk_id) DO NOTHING;