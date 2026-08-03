# Global Kiosk Kill Switch (Super Admin Only)

Yes, this can be done. A single toggle in the admin panel, visible only to super admins, that puts every kiosk out of service instantly — and restores them with the same click.

## How it works

1. A single global flag is stored in the backend (a one-row `system_settings` table with `kiosks_disabled`, plus who changed it and when).
2. Only super admins can change it. Everyone else — including regular admins — can read it but cannot flip it (enforced by database access rules, not just hidden UI).
3. The kiosk app asks the backend for this flag as part of the config it already fetches, and keeps re-checking on a short interval (every ~15 seconds) plus immediately after every screen change.
4. When the flag is on, each kiosk shows the existing "Out of Service" overlay and blocks all donation actions. When it is turned off, kiosks return to normal automatically within seconds — no restart or manual intervention.

## What the super admin sees

- A clearly styled card at the top of the Admin Dashboard: "Kiosk Service Control" with a toggle.
- A confirmation dialog before disabling ("This will take all kiosks out of service immediately").
- Live status line: "All kiosks disabled by <name> at <time>" when active.
- The card is not rendered at all for non-super-admins.

## Important notes

- The flag is global and independent of each kiosk's own status, so re-enabling never overwrites kiosks you deliberately set to inactive or maintenance.
- A transaction already in progress on the payment screen is allowed to finish; the block applies at the start of the next donation.
- Offline kiosks apply the block as soon as they regain connectivity.

## Technical details

- Migration: `public.system_settings` (single row, `kiosks_disabled boolean`, `updated_by`, `updated_at`), with GRANTs, RLS enabled, read allowed to authenticated, write restricted via `has_role(auth.uid(), 'super_admin')`.
- `supabase/functions/get-kiosk-config/index.ts`: include `globalDisabled` in the response payload (service role read, so kiosks need no table access).
- `src/lib/kioskConfig.ts`: cache the flag in localStorage alongside `payment_mode`; expose `isGloballyDisabled()`.
- `src/pages/kiosk/KioskHomepage.tsx`: treat `globalDisabled` as a status that renders the existing out-of-service overlay; add a lightweight polling interval (kiosks realtime was intentionally removed, so polling is the mechanism).
- Kiosk flow entry points (`PresetAmountsPage`, `AmountPage`, `PaymentRequestPage`) re-check the cached flag and bounce to the homepage overlay if set.
- New `src/components/admin/GlobalKioskKillSwitch.tsx` rendered in `AdminDashboard.tsx`, gated by a super-admin role check like the one in `AdminsManagement.tsx`.
