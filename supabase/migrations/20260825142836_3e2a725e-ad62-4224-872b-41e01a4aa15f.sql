ALTER TABLE public.kiosk_settings DROP COLUMN IF EXISTS soft_pos_config;

DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;

CREATE POLICY "Users can view their own profile picture"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);