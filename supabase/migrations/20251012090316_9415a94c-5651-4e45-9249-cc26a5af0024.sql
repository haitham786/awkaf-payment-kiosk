-- Add super_admin role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Update has_role function with NULL check and proper search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END;
$$;

-- Update handle_new_user with error handling to prevent signup blocking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Update update_updated_at_column with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update generate_reference_number with proper search_path
CREATE OR REPLACE FUNCTION public.generate_reference_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ref_number TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    ref_number := 'TXN' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 9));
    
    SELECT COUNT(*) INTO exists_check 
    FROM public.transactions 
    WHERE reference_number = ref_number;
    
    EXIT WHEN exists_check = 0;
  END LOOP;
  
  RETURN ref_number;
END;
$function$;

-- Update set_transaction_reference with proper search_path
CREATE OR REPLACE FUNCTION public.set_transaction_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := public.generate_reference_number();
  END IF;
  RETURN NEW;
END;
$function$;