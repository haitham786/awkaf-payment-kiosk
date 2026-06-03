
# Twilio WhatsApp Receipts (alongside Infocomm SMS)

Add WhatsApp delivery of donation receipts via Twilio, with an admin switch to choose **SMS (Infocomm)**, **WhatsApp (Twilio)**, or **Both** — globally or per kiosk.

## 1. Connector & Secrets

- Use the Lovable **Twilio connector** (gateway-based, handles auth refresh, no manual key handling).
- After connect, `TWILIO_API_KEY` + `LOVABLE_API_KEY` become available to edge functions automatically.
- User must complete two Twilio-side prerequisites before live use:
  1. Activate a **WhatsApp Sender** (Twilio Sandbox for testing, or an approved Business number for production).
  2. Submit an **approved WhatsApp message template** in Arabic for the donation receipt (free-form messages outside the 24h session window are rejected).

## 2. Database

New table `whatsapp_settings` (admin-managed, mirrors `sms_settings` pattern):
- `from_number` (e.g. `whatsapp:+14155238886`)
- `template_sid` (approved template ID)
- `template_language` (default `ar`)
- `is_enabled` boolean

Extend `transactions`:
- `whatsapp_status` text default `'not_sent'` (`sent` / `failed` / `not_sent`)

Extend `kiosks.configuration` JSON (no schema change) with:
- `receipt_channel`: `'sms' | 'whatsapp' | 'both'` (default `'sms'`)

All new tables get explicit GRANTs and admin-only RLS.

## 3. Edge Function: `send-whatsapp`

Mirrors `send-sms`:
- Validates transaction is `completed` and not already sent on this channel
- Calls Twilio via gateway: `POST https://connector-gateway.lovable.dev/twilio/Messages.json`
  - `To: whatsapp:+968XXXXXXXX`
  - `From: <from_number>`
  - `ContentSid: <template_sid>` + `ContentVariables` JSON (amount, category, ref, date)
- Updates `transactions.whatsapp_status`
- Returns the same shape as `send-sms` for UI parity

## 4. Dispatcher Update

Where the kiosk currently calls `send-sms` after a successful transaction, replace with a small dispatcher that reads `receipt_channel` (kiosk config, falling back to a global default) and invokes `send-sms`, `send-whatsapp`, or both in parallel.

## 5. Admin UI

**New page:** `/admin/whatsapp-settings` (`WhatsAppSettings.tsx`) — same layout as `SMSSettings.tsx`:
- From number, Template SID, Language, Enabled toggle
- "Send test WhatsApp" using the donor's number

**Kiosks → Edit Kiosk:** add a `Receipt Channel` selector (SMS / WhatsApp / Both), stored in `kiosks.configuration.receipt_channel`.

**Admin Dashboard nav:** add WhatsApp Settings link next to SMS Settings.

## 6. Out of Scope

- No Twilio billing/usage dashboard (separate request).
- No voice/IVR or Twilio Pay.
- WhatsApp template approval is done by the user inside the Twilio console; we only store the SID.

---

### Implementation order
1. Connect Twilio connector + confirm `TWILIO_API_KEY` present.
2. Migration: `whatsapp_settings` table + `transactions.whatsapp_status` column + GRANTs/RLS.
3. `send-whatsapp` edge function.
4. Admin WhatsApp Settings page + nav entry.
5. Per-kiosk `receipt_channel` selector in Edit Kiosk.
6. Dispatcher wiring in the post-transaction flow.
