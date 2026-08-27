-- Least-privilege grants for the two donor/credential tables.
-- RLS already restricts both to admins, but the Data API grants were still
-- wide open to the anonymous role. Removing those grants makes the protection
-- two-layered: an accidental future policy can no longer expose donor mobile
-- numbers or SMS provider credentials to unauthenticated callers.

-- ---------------------------------------------------------------- transactions
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.transactions FROM authenticated;

-- Admin reporting screens read and reconcile transactions; every row is still
-- gated by the existing has_role(auth.uid(),'admin') policies.
GRANT SELECT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

-- ---------------------------------------------------------------- sms_settings
REVOKE ALL ON public.sms_settings FROM anon;
REVOKE ALL ON public.sms_settings FROM authenticated;

-- Only the admin SMS settings screen manages these rows (admin-only policy).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_settings TO authenticated;
GRANT ALL ON public.sms_settings TO service_role;