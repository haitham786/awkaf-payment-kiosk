DROP POLICY IF EXISTS "Admins and super admins can manage all roles" ON public.user_roles;

CREATE POLICY "Super admins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins manage non-super-admin roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND role <> 'super_admin'
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND role <> 'super_admin'
);

ALTER PUBLICATION supabase_realtime DROP TABLE public.kiosks;