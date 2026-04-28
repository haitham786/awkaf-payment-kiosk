# Integrate Omantel iSmart SMS Gateway

## What this changes

The current `send-sms` Edge Function sends a generic JSON `{to, from, message, username, password}` payload with a `Bearer` token — that does not match Omantel's iSmart gateway. iSmart expects an **HTTP POST with form-encoded query-style parameters** and returns a **plain numeric code** (1 = success, 2–20 = errors). We will rewrite the function to speak this protocol and adjust the admin Settings UI labels accordingly. The kiosk SMS flow, transaction lookup, duplicate-send guard, and Arabic message body all remain unchanged.

## iSmart protocol (from your PDF)

- **Endpoint**: `https://www.ismartsms.net/iBulkSMS/HttpWS/SMSDynamicRefIntlAPI.aspx`
- **Method**: HTTP POST, body `application/x-www-form-urlencoded`
- **Parameters**:
  - `UserId` — provided by Infocomm
  - `Password` — provided by Infocomm
  - `MobileNo` — international format with country code (e.g. `96879XXXXXXX`), comma-separated for multiple
  - `Message` — text body
  - `PushDateTime` — `MM/DD/YYYY hh:mm:ss` (omit → "send now")
  - `Lang` — `0` English, `64` Arabic
  - `Header` — sender header, max 11 chars, registered with Infocomm
  - `referenceIds` — optional 3–6 digit number
- **Response**: plain text body containing one of `1`–`20` (1 = success). All others are failures with specific meanings (3 = bad credentials, 4 = low credit, 6 = message too long, 19 = header not registered, etc.).

## Changes

### 1. `supabase/functions/send-sms/index.ts`
- Read the same row from `sms_settings`. Map columns to iSmart parameters:
  - `api_endpoint` → POST URL (default to the iSmart URL above if empty)
  - `api_username` → `UserId`
  - `api_password` → `Password`
  - `sender_id`    → `Header` (truncate/validate ≤ 11 chars)
  - `api_key`      → kept in schema for backward compatibility but no longer required
- Build form body with `URLSearchParams`, set `Content-Type: application/x-www-form-urlencoded`, `Accept: text/plain`.
- Send `Lang=64` (Arabic, since the message is Arabic) and pass the transaction reference (digits only, last 6 chars) as `referenceIds`.
- Format `MobileNo` to international: strip `+`/spaces, ensure it starts with `968`.
- Parse response as text, extract the leading integer, and map to a human-readable result. Treat `1` as success; everything else updates `sms_status='failed'` with the mapped reason returned to the UI.
- Keep all existing logic: transaction lookup, completed-status check, duplicate-send guard, `sms_status` + `mobile_number` update on the transaction row, CORS headers, Arabic message body.

### 2. `src/pages/admin/SMSSettings.tsx`
- Re-label the form for iSmart clarity (no schema change needed):
  - `api_endpoint` → "API URL" with placeholder `https://www.ismartsms.net/iBulkSMS/HttpWS/SMSDynamicRefIntlAPI.aspx`
  - `api_username` → "User ID (UserId)"
  - `api_password` → "Password"
  - `sender_id`    → "Sender Header (max 11 chars, registered with Infocomm)" with `maxLength={11}`
  - Hide / mark optional the `api_key` field (no longer used by iSmart)
- Update the "Send Test SMS" button to surface the iSmart return-code message returned by the edge function.

### 3. No database migration
The existing `sms_settings` columns cover every iSmart field. `api_key` becomes unused but is left in place to avoid a destructive migration.

## Out of scope
- The Thawani Lamsa native bridge work from previous turns is untouched.
- No changes to kiosk SMS-trigger code (`MobileNumberPage`/`ThankYouPage`) — they already call `send-sms` with the correct payload.

## After deploy
You'll need to enter your Infocomm-issued **UserId**, **Password**, and **Header** (and confirm the API URL) in Admin → SMS Settings, then hit "Send Test SMS" to verify return code `1`.
