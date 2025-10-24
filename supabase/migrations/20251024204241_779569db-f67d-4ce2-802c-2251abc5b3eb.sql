-- Create profile pictures bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for profile pictures
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Profile pictures are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can update their own profile picture"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own profile picture"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);