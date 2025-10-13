-- Add sound_enabled configuration to kiosks table
-- This allows admins to control sound effects per kiosk

-- Update existing kiosks to have sound enabled by default
UPDATE kiosks 
SET configuration = jsonb_set(
  COALESCE(configuration, '{}'::jsonb),
  '{sound_enabled}',
  'true'::jsonb
) 
WHERE configuration IS NULL OR NOT (configuration ? 'sound_enabled');

-- For new kiosks, sound will be enabled by default in the app