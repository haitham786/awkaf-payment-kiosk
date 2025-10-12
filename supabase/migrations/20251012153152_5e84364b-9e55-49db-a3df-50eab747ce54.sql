-- Create kiosk_settings table for global kiosk configuration
CREATE TABLE IF NOT EXISTS public.kiosk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  background_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert initial row (singleton table)
INSERT INTO public.kiosk_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.kiosk_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view kiosk settings"
  ON public.kiosk_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can update kiosk settings"
  ON public.kiosk_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for kiosk backgrounds
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kiosk-backgrounds', 'kiosk-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for kiosk backgrounds
CREATE POLICY "Public can view kiosk backgrounds"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'kiosk-backgrounds');

CREATE POLICY "Admins can upload kiosk backgrounds"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'kiosk-backgrounds' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update kiosk backgrounds"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'kiosk-backgrounds' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete kiosk backgrounds"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'kiosk-backgrounds' AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_kiosk_settings_updated_at
  BEFORE UPDATE ON public.kiosk_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();