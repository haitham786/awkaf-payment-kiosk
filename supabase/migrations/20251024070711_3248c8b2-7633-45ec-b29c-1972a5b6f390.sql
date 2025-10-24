-- Create organization logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for organization logos bucket
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Organization logos are publicly accessible'
  ) THEN
    CREATE POLICY "Organization logos are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'organization-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload organization logos'
  ) THEN
    CREATE POLICY "Admins can upload organization logos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'organization-logos' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can update organization logos'
  ) THEN
    CREATE POLICY "Admins can update organization logos"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'organization-logos' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can delete organization logos'
  ) THEN
    CREATE POLICY "Admins can delete organization logos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'organization-logos' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;