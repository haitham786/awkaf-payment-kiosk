
-- 1) Restrict transactions SELECT/UPDATE to authenticated admins (deny anon).
ALTER POLICY "Admins can view all transactions" ON public.transactions TO authenticated;
ALTER POLICY "Admins can update transactions" ON public.transactions TO authenticated;

-- 2) Restrict offline_transaction_queue admin policy to authenticated.
ALTER POLICY "Admins can manage offline queue" ON public.offline_transaction_queue TO authenticated;
-- Keep "Anyone can insert to offline queue" available to anon (kiosk app uses anon),
-- but add a sanity WITH CHECK so only well-formed payloads are accepted.
DROP POLICY IF EXISTS "Anyone can insert to offline queue" ON public.offline_transaction_queue;
CREATE POLICY "Anyone can insert to offline queue"
  ON public.offline_transaction_queue
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (jsonb_typeof(transaction_data) = 'object');

-- 3) user_roles: scope the admin ALL policy to authenticated and add explicit WITH CHECK.
DROP POLICY IF EXISTS "Admins and super admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins and super admins can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
-- Also scope "Users can view their own roles" to authenticated.
ALTER POLICY "Users can view their own roles" ON public.user_roles TO authenticated;

-- 4) transactions INSERT policy already needs to remain open to anon (kiosks).
--    Scope the policy explicitly so it doesn't sit on the {public} catch-all role.
DROP POLICY IF EXISTS "Kiosks can create transactions" ON public.transactions;
CREATE POLICY "Kiosks can create transactions"
  ON public.transactions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    amount_baisas > 0
    AND amount_baisas <= 100000000
  );
