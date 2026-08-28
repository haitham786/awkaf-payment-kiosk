# Read-Only Database Role for Claude AI Diagnosis

## Goal
Create a scoped, read-only database login that lets Claude inspect kiosk, transaction and terminal data to diagnose the intermittent Apex hardware-POS dispatch failures, without exposing write access or sensitive secrets.

## What will be built
1. A database migration that creates a dedicated read-only role (`claude_read_only`) with a strong random password.
2. `SELECT` grants limited to diagnostic tables only:
   - `public.transactions`
   - `public.apex_terminal_sessions`
   - `public.kiosks`
   - `public.kiosk_settings`
   - `public.offline_transaction_queue`
   - `public.messaging_rates`
3. A private connection-info note containing host, port, database name, username and password, shared with you outside of chat so you can paste it into Claude's database connector.

## What will NOT be exposed
- `public.kiosk_secrets` (contains Apex secure key / Soft-POS auth key / access tokens).
- `public.profiles`, `auth.users`, `public.user_roles`.
- Service-role key or any Supabase dashboard credentials.

## Security safeguards
- Role has no `INSERT`, `UPDATE`, `DELETE` or DDL privileges.
- Login uses a long random password generated at migration time.
- `GRANT USAGE ON SCHEMA public` and `GRANT SELECT` only on the listed tables.
- Default privileges are not altered, so future tables are not automatically exposed.

## How Claude will use it
Claude can run `SELECT` queries against the granted tables to inspect:
- Recent transaction rows, statuses and POS responses.
- `apex_terminal_sessions` state, lease expiry and results.
- Kiosk status and configuration.

This is the same diagnostic data we already use internally; read access removes the need to manually relay query results.

## Important note
Because this project runs on Lovable Cloud, there is no separate Supabase dashboard login for you. The connection hostname contains internal Supabase identifiers, so after you approve this plan I will provide the connection details in a private document rather than in chat.