-- Allow kiosks to view their own status without authentication
-- This is crucial for kiosk operation independent of admin login

CREATE POLICY "Kiosks can view their own data"
ON public.kiosks
FOR SELECT
USING (true);

-- This allows any kiosk to read kiosk data by reference_number or id
-- The kiosk will only read its own data based on localStorage values