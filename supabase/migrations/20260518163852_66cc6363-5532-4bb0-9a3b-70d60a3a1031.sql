ALTER TABLE public.donation_categories
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS info_text_en text;