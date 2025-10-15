-- Drop trigger first with CASCADE
DROP TRIGGER IF EXISTS trigger_set_category_reference ON donation_categories CASCADE;

-- Now drop functions
DROP FUNCTION IF EXISTS set_category_reference() CASCADE;
DROP FUNCTION IF EXISTS generate_category_reference() CASCADE;

-- Make category_reference nullable to allow manual entry
ALTER TABLE donation_categories ALTER COLUMN category_reference DROP NOT NULL;