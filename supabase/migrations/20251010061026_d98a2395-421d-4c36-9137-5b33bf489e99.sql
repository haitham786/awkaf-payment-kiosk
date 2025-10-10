-- Add storage bucket for category icons
INSERT INTO storage.buckets (id, name, public) 
VALUES ('category-icons', 'category-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Add icon_url and info_text to donation_categories
ALTER TABLE donation_categories 
ADD COLUMN IF NOT EXISTS icon_url TEXT,
ADD COLUMN IF NOT EXISTS info_text TEXT;

-- Add mobile_number and sms_status to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS sms_status TEXT DEFAULT 'not_sent';

-- Create SMS settings table for admin configuration
CREATE TABLE IF NOT EXISTS sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_endpoint TEXT NOT NULL,
  api_username TEXT,
  api_key TEXT,
  api_password TEXT,
  sender_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on sms_settings
ALTER TABLE sms_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SMS settings
CREATE POLICY "Admins can manage SMS settings"
ON sms_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add first_login flag to profiles for new admin password setup
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT true;

-- Create storage policies for category icons
CREATE POLICY "Public can view category icons"
ON storage.objects
FOR SELECT
USING (bucket_id = 'category-icons');

CREATE POLICY "Admins can upload category icons"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'category-icons' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update category icons"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'category-icons' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete category icons"
ON storage.objects
FOR DELETE
USING (bucket_id = 'category-icons' AND has_role(auth.uid(), 'admin'::app_role));

-- Add trigger to update sms_settings updated_at
CREATE TRIGGER update_sms_settings_updated_at
BEFORE UPDATE ON sms_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();