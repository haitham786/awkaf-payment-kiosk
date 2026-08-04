# ApexECR Hardware POS Integration Plan (AFS / Ahli Bank)

Migrate the kiosk from Thawani Soft POS to an external hardware EFTPOS terminal driven over the internet through the ApexECR web service. No USB, no serial cable, no Android SDK.

## How it will work

```text
Kiosk (Android/Capacitor)
   |  amount + kiosk id  (HTTPS, no credentials on device)
   v
Edge function: apex-ecr-payment      <-- holds MID / TID / MerchantSecureKey
   |  SOAP/XML FinancialTxnRequest (SALE)
   v
ApexECR Server (AFS/Apex hosted)
   |  pushes transaction to the paired terminal
   v
Hardware POS terminal  -> donor taps card -> approval
   |  response travels back up the same path
   v
Kiosk shows Thank You + SMS/WhatsApp receipt (existing pipeline, unchanged)
```

The donor never leaves the kiosk app. The kiosk screen says "tap your card on the terminal" while the edge function waits for the ApexECR response.

## Scope of work

**1. New payment mode**
Add `hardware_pos` as a fourth kiosk payment mode alongside the existing Soft POS, Payment Gateway and Test modes. Admins pick it per kiosk in Manage Kiosks, exactly like today. Routing stays instant via the existing cached-mode mechanism.

**2. Admin configuration**
Under Edit Kiosk, a new Hardware POS section for: Terminal ID (TID), Merchant ID (MID), Merchant Secure Key, ApexECR service URL, currency code (OMR = 512), and an environment switch (UAT / production). The secure key is stored in the private secrets table, never in the public kiosk config and never sent to the device.

**3. Backend: `apex-ecr-payment` edge function**
- Builds the SOAP envelope for `PerformFinancialTransaction` with `TransactionType = SALE`, the donation amount, and an ECR invoice/reference number derived from our transaction id.
- Posts it to the ApexECR URL over HTTPS with a generous timeout (card tap can take 30–60s).
- Parses `WebResponseStatus`, `PosRespStatus`, `PosRespCode`, `PosRRN`, `PosAuthCode`, masked PAN, batch/STAN, and the formatted receipt text.
- Writes the transaction through the existing `process-payment` path so reporting, references and receipts stay identical.
- Sets `EnablePrintPosReceipt = 0` (no paper receipt at the terminal) since receipts go by SMS/WhatsApp.

**4. Backend: `apex-ecr-recovery` (safety net)**
If the kiosk loses the response but the terminal approved, call ApexECR `EnquiryByRef` with the original invoice number to reconcile, and only then mark the donation successful. Prevents lost-but-charged donations.

**5. Kiosk UI**
A new tap-on-terminal screen matching the existing Liquid Glass design and the current Thawani tap screen: Arabic primary with English beneath, the amount with the Omani Rial logo, an animated tap indicator, a cancel button and a timeout back to home. Approved and declined states reuse the existing screens.

**6. Cancellation**
Wire the ApexECR cancel call to the on-screen Cancel button so an abandoned tap does not leave the terminal hanging.

**7. Coexistence**
Thawani Soft POS and Thawani Checkout code stay in place and functional. Migration is per kiosk by flipping the payment mode, so you can pilot on one kiosk before rolling out.

## Blocked until AFS supplies these

Implementation cannot start until the bank provides:

1. The WSDL file (Appendix A, referenced in the spec but not included).
2. UAT and production ApexECR endpoint URLs.
3. Test MID, TID and Merchant Secure Key.
4. Terminal-to-TID pairing procedure and the terminal model AFS will ship.
5. Network rules: TLS version, and whether calls must come from a fixed IP or VPN. Our edge functions have dynamic outbound IPs, so an IP allowlist would force a design change.
6. OMR currency code confirmation and 3-decimal baisa amount formatting.
7. Full host response/decline code list.
8. Timeout, retry and duplicate-charge (idempotency) rules for SALE.
9. Confirmation that unattended kiosk operation is certified, and how signature-CVM transactions are handled with no cashier present.

Items 1–3 and 5 are the hard blockers. Everything else can be worked around during UAT.

## Technical notes

- Section 5 of the spec (the Windows DLL / VB6 interface) is ignored entirely; only the SOAP web interface applies.
- SOAP envelope construction is done manually in Deno (no WSDL codegen tooling needed) once the WSDL confirms the exact namespaces and operation names.
- `MerchantSecureKey`, MID and TID live in `kiosk_secrets` and are read only by the edge function using the service role.
- Amounts are sent as decimal strings; our internal baisa integers convert at the edge, mirroring the existing Thawani conversion logic.
- No new client dependencies; the kiosk only calls our own edge function.

## Estimate

Roughly 2–3 working sessions once credentials and the WSDL are in hand: one for schema, admin UI and the edge function, one for the kiosk screen and recovery flow, one for UAT fixes against the live terminal.
