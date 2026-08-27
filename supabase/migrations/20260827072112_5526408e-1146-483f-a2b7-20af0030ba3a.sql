CREATE POLICY "No client access to Apex terminal sessions"
ON public.apex_terminal_sessions
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);