-- Add quranic_verse field to donation_categories table
ALTER TABLE public.donation_categories
ADD COLUMN IF NOT EXISTS quranic_verse TEXT;