-- Lock client-side writes on financial tables: inserts/deletes only via service role (edge functions)

-- transactions
REVOKE INSERT, DELETE ON public.transactions FROM anon, authenticated;
GRANT ALL ON public.transactions TO service_role;

DROP POLICY IF EXISTS "No client inserts on transactions" ON public.transactions;
CREATE POLICY "No client inserts on transactions"
ON public.transactions
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on transactions" ON public.transactions;
CREATE POLICY "No client deletes on transactions"
ON public.transactions
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);

-- offline_transaction_queue
REVOKE INSERT, DELETE ON public.offline_transaction_queue FROM anon, authenticated;
GRANT ALL ON public.offline_transaction_queue TO service_role;

DROP POLICY IF EXISTS "No client inserts on offline queue" ON public.offline_transaction_queue;
CREATE POLICY "No client inserts on offline queue"
ON public.offline_transaction_queue
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on offline queue" ON public.offline_transaction_queue;
CREATE POLICY "No client deletes on offline queue"
ON public.offline_transaction_queue
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);