-- Add new status to kiosk_status enum for pending approval
ALTER TYPE kiosk_status ADD VALUE IF NOT EXISTS 'pending_approval';

-- Add category_reference column to donation_categories
ALTER TABLE donation_categories 
ADD COLUMN IF NOT EXISTS category_reference TEXT UNIQUE;

-- Function to generate category reference numbers
CREATE OR REPLACE FUNCTION generate_category_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ref_number TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    ref_number := 'CAT' || LPAD((floor(random() * 9999) + 1)::TEXT, 4, '0');
    
    SELECT COUNT(*) INTO exists_check 
    FROM donation_categories 
    WHERE category_reference = ref_number;
    
    EXIT WHEN exists_check = 0;
  END LOOP;
  
  RETURN ref_number;
END;
$$;

-- Update existing categories with reference numbers
UPDATE donation_categories 
SET category_reference = generate_category_reference()
WHERE category_reference IS NULL;

-- Make category_reference NOT NULL after populating
ALTER TABLE donation_categories 
ALTER COLUMN category_reference SET NOT NULL;

-- Add trigger to auto-generate category reference for new categories
CREATE OR REPLACE FUNCTION set_category_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category_reference IS NULL THEN
    NEW.category_reference := generate_category_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_category_reference
BEFORE INSERT ON donation_categories
FOR EACH ROW
EXECUTE FUNCTION set_category_reference();

-- Add category_reference to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS category_reference TEXT;