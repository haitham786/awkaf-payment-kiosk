DROP POLICY IF EXISTS "Kiosks can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can insert to offline queue" ON public.offline_transaction_queue;
-- Inserts for both tables now flow exclusively through edge functions using the
-- service role, which bypasses RLS. No anon/authenticated INSERT policy is needed.
REVOKE INSERT ON public.transactions FROM anon, authenticated;
REVOKE INSERT ON public.offline_transaction_queue FROM anon, authenticated;