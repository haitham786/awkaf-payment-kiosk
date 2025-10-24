-- Add logo_url column to kiosk_settings table
ALTER TABLE public.kiosk_settings 
ADD COLUMN IF NOT EXISTS logo_url text;