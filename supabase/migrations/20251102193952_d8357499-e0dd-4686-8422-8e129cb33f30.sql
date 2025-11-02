-- Remove quranic_verse from donation_categories (it's not category-specific)
ALTER TABLE public.donation_categories
DROP COLUMN IF EXISTS quranic_verse;

-- Add quranic_verse to kiosk_settings (it's a global kiosk setting)
ALTER TABLE public.kiosk_settings
ADD COLUMN IF NOT EXISTS quranic_verse TEXT DEFAULT 'وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ';