REVOKE EXECUTE ON FUNCTION public.report_homepage_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_homepage_overview(integer) TO authenticated, service_role;