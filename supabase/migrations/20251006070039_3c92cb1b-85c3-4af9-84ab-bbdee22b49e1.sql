-- Create donation_categories table for admin-managed categories
CREATE TABLE IF NOT EXISTS public.donation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add reference_number to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS reference_number TEXT UNIQUE;

-- Add reference_number to kiosks table
ALTER TABLE public.kiosks 
ADD COLUMN IF NOT EXISTS reference_number TEXT UNIQUE;

-- Enable RLS on donation_categories
ALTER TABLE public.donation_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for donation_categories (using existing admin role)
CREATE POLICY "Anyone can view visible categories"
ON public.donation_categories FOR SELECT
USING (is_visible = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all categories"
ON public.donation_categories FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert categories"
ON public.donation_categories FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
ON public.donation_categories FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
ON public.donation_categories FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default categories
INSERT INTO public.donation_categories (category_id, title, description, display_order, is_visible) VALUES
  ('ashura', 'عاشوراء', 'تبرعات عاشوراء', 1, true),
  ('ramadan', 'رمضان', 'تبرعات رمضان', 2, true),
  ('zakat', 'زكاة', 'الزكاة', 3, true),
  ('sadaqah', 'صدقة', 'صدقة عامة', 4, true),
  ('charity', 'أعمال خيرية', 'الأعمال الخيرية', 5, true),
  ('mosque', 'تبرعات للمآتم', 'دعم المآتم', 6, true),
  ('orphans', 'أيتام', 'رعاية الأيتام', 7, true),
  ('education', 'تعليم', 'دعم التعليم', 8, true)
ON CONFLICT (category_id) DO NOTHING;

-- Create function to generate alphanumeric reference numbers
CREATE OR REPLACE FUNCTION public.generate_reference_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_number TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate 12-character alphanumeric reference (e.g., TXN7K9M2P4H8)
    ref_number := 'TXN' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 9));
    
    -- Check if it already exists
    SELECT COUNT(*) INTO exists_check 
    FROM public.transactions 
    WHERE reference_number = ref_number;
    
    EXIT WHEN exists_check = 0;
  END LOOP;
  
  RETURN ref_number;
END;
$$;

-- Create trigger to auto-generate reference numbers for transactions
CREATE OR REPLACE FUNCTION public.set_transaction_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := public.generate_reference_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_transaction_reference_trigger
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_transaction_reference();

-- Create updated_at trigger for donation_categories
CREATE TRIGGER update_donation_categories_updated_at
BEFORE UPDATE ON public.donation_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();