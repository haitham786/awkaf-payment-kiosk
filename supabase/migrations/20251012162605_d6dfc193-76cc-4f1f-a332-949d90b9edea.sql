-- Enable realtime for kiosks table so changes sync immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.kiosks;

-- Ensure admins can insert kiosks (should already exist, but verifying)
DROP POLICY IF EXISTS "Admins can insert kiosks" ON public.kiosks;
CREATE POLICY "Admins can insert kiosks"
ON public.kiosks
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));