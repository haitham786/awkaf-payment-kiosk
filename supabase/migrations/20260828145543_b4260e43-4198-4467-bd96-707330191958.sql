REVOKE EXECUTE ON FUNCTION public.mark_apex_cancel_dispatched(uuid, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.acquire_apex_terminal_session(uuid, text, uuid, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.begin_apex_sale(uuid, uuid, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.finish_apex_terminal_session(uuid, uuid, text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.claim_stale_apex_session(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.activate_recovered_apex_session(uuid, uuid, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.request_apex_terminal_cancellation(uuid, uuid) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.mark_apex_cancel_dispatched(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_apex_terminal_session(uuid, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_apex_sale(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_apex_terminal_session(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_stale_apex_session(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_recovered_apex_session(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_apex_terminal_cancellation(uuid, uuid) TO service_role;