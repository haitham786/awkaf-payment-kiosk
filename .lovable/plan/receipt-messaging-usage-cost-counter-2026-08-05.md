# Receipt Messaging Usage & Cost Counter

Add an admin panel view that shows how many receipts were delivered by SMS and by WhatsApp over a chosen period, and what that traffic costs at configurable per-message rates.

## Why

Receipts already record their outcome per transaction (`sms_status` and `whatsapp_status` on the transactions table, each `not_sent` / `sent` / `failed`). That data is enough to count and price delivery without any new tracking, but nothing in the admin panel surfaces it today.

## What the admin will see

A "Receipt Delivery & Cost" section, filterable by the same period options already used in statistics (daily / weekly / monthly / yearly) and by kiosk:

- SMS: sent, failed, not sent
- WhatsApp: sent, failed, not sent
- Estimated cost per channel = sent count x configured unit rate
- Combined estimated total, shown in OMR with the Omani Rial logo
- A simple bar or split showing channel mix

Rates are entered by the admin (not hardcoded), so they can be updated as Twilio/Meta or the SMS gateway change prices:

- SMS unit cost (OMR per message)
- WhatsApp unit cost (OMR per message)

These live in a small settings block so the numbers stay accurate over time. Costs are labelled "estimated" everywhere, since the authoritative figure is the provider's invoice.

## Technical notes

- New table `messaging_rates` (single row): `sms_unit_cost_omr numeric`, `whatsapp_unit_cost_omr numeric`, timestamps. Admin-only RLS (`has_role(auth.uid(),'admin')`) plus the required GRANTs; no anon access.
- Counting query: aggregate `transactions` grouped by `sms_status` and `whatsapp_status` within the selected date range and optional `kiosk_id`. No schema change to `transactions` needed.
- UI added to `src/pages/admin/EnhancedStatistics.tsx` (reusing its existing period/kiosk filter state) with the rate inputs placed in `src/pages/admin/WhatsAppSettings.tsx` and `SMSSettings.tsx`, or a shared small card — final placement decided during build to avoid duplicating the same form twice.
- Read-only feature: no changes to `receiptDispatcher.ts`, `send-sms`, or `send-whatsapp`.

## Out of scope

- Pulling real billed amounts from Twilio's API (possible later via the connector's Usage Records endpoint, but adds an API call and its own auth surface).
- Changing channel routing or the "both" behaviour.
