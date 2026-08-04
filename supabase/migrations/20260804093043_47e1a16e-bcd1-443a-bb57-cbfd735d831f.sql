ALTER TABLE public.kiosk_secrets
  ADD COLUMN IF NOT EXISTS apex_secure_key text;