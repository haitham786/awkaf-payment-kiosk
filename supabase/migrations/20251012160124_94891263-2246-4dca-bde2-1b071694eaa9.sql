-- Add DELETE policy for admins on kiosks table
CREATE POLICY "Admins can delete kiosks"
ON public.kiosks
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));