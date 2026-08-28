DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'claude_read_only') THEN
    CREATE ROLE claude_read_only WITH LOGIN PASSWORD 'eXB7M0/S+TF2mVNXjvGkgUWWNqbLc43Qq6ADm6mFncc=';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO claude_read_only;
GRANT SELECT ON public.transactions TO claude_read_only;
GRANT SELECT ON public.apex_terminal_sessions TO claude_read_only;
GRANT SELECT ON public.kiosks TO claude_read_only;
GRANT SELECT ON public.kiosk_settings TO claude_read_only;
GRANT SELECT ON public.offline_transaction_queue TO claude_read_only;
GRANT SELECT ON public.messaging_rates TO claude_read_only;

ALTER ROLE claude_read_only SET search_path TO public;