-- Update user_roles RLS policy to allow both admin and super_admin to manage roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins and super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Add mobile_number column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mobile_number text;