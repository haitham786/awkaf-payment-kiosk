# Guarantee 1:1 Kiosk ↔ POS Terminal Pairing

## How routing works now

Each kiosk device holds its own kiosk identity locally and sends it with every payment request. The backend loads that kiosk's record, reads the Terminal ID (TID), Merchant ID (MID) and that kiosk's own secure key, and sends the sale to the bank addressed to that TID. The bank pushes the prompt to the physical terminal registered under that TID.

```text
Kiosk A ──(kiosk id A)──> Backend ──(TID 1001 + key A)──> ApexECR ──> Terminal next to Kiosk A
Kiosk B ──(kiosk id B)──> Backend ──(TID 1002 + key B)──> ApexECR ──> Terminal next to Kiosk B
```

So cross-firing is only possible if the same TID is entered on two kiosk records by mistake, or a kiosk device is re-registered against the wrong kiosk record. The plan closes both gaps.

## What to add

1. **TID uniqueness enforced in the database**
   A uniqueness rule on the Terminal ID across all kiosks, so the same terminal can never be attached to two kiosks. Saving a duplicate is rejected at the source, not just in the form.

2. **Duplicate check in the admin form**
   Before saving a kiosk in Manage Kiosks, check the entered TID/MID against other kiosks and show a clear inline error naming the kiosk that already uses that terminal.

3. **Pairing summary in the kiosk list**
   Show each kiosk's paired terminal (TID, and MID/environment) directly in the kiosks table, so a super admin can eyeball the whole fleet and spot a wrong pairing instantly.

4. **Backend guard on every sale**
   The payment function refuses to send a sale when the kiosk has no TID, or when its TID is shared with another kiosk record, returning a clear configuration error instead of routing to an ambiguous terminal.

5. **"Verify terminal" button per kiosk**
   In the kiosk edit dialog, a button that sends a harmless enquiry to the configured terminal and reports back whether the bank recognises that TID/MID pair — a one-click confirmation that the right terminal answers before the kiosk goes live.

6. **Terminal identity recorded on each transaction**
   Store the TID used on every transaction record so reports can prove which terminal took which donation, and any mis-pairing is auditable after the fact.

## Technical notes

- Uniqueness is applied as a partial unique index over the hardware POS TID inside the kiosk configuration, limited to kiosks actually using hardware POS mode.
- The admin duplicate check runs before submit and covers create and edit paths (excluding the kiosk being edited).
- The backend guard lives in the existing payment edge function, before the sale envelope is built; it reuses the service-role lookup already in place.
- The verify action reuses the existing enquiry action; no new bank capability is required.
- The TID is written to the transaction record via the existing payment pipeline payload; no sensitive keys are added to any client response.

## Out of scope

- No cable/USB pairing; routing stays cloud-based via the bank's terminal registry.
- No change to Soft POS, Thawani gateway or test payment modes.
