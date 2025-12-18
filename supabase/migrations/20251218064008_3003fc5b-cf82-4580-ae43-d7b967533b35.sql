-- Fix offline_transaction_queue RLS policy - overly permissive
-- Remove the dangerous public policy and add proper restrictions

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all operations on offline_transaction_queue" ON public.offline_transaction_queue;

-- Policy 1: Admins can do everything (view, manage, delete)
CREATE POLICY "Admins can manage offline queue"
ON public.offline_transaction_queue
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy 2: Allow INSERT for tracking synced transactions (kiosk use case)
-- Since kiosks may not be authenticated, allow inserts but restrict other operations
CREATE POLICY "Anyone can insert to offline queue"
ON public.offline_transaction_queue
FOR INSERT
WITH CHECK (true);

-- Note: SELECT, UPDATE, DELETE are now restricted to admins only
-- Kiosks can queue transactions but cannot read/modify the queue