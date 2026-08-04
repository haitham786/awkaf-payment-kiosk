# ApexECR Go-Live Readiness: What Ahli Bank / AFS Must Provide

## Current status (verified in the codebase)

The ApexECR hardware POS integration is built and wired end to end:

- Backend function `apex-ecr-payment` handles SALE, ENQUIRY (recovery) and CANCEL.
- SOAP envelope builders and response parsing live in a shared helper.
- Transactions are recorded through the existing payment pipeline, protected by an internal service token so a device cannot forge a hardware sale.
- Kiosk screens: tap-on-terminal, declined and error states, with cancel and timeout.
- Admin panel: per-kiosk Hardware POS mode with Service URL, MID, TID, currency code, timeout and Merchant Secure Key (key stored privately, never sent to the device).
- Kiosk config endpoint strips all merchant credentials before sending config to the kiosk.

Nothing further can be validated without live bank artefacts. The integration currently runs against assumed SOAP namespaces and operation names.

## What AFS / Ahli Bank must supply

**Hard blockers**

1. WSDL file (Appendix A of the spec) — confirms exact namespaces, SOAP action names and field casing.
2. UAT and production ApexECR endpoint URLs.
3. Test MID, TID and Merchant Secure Key for UAT, then the production set.
4. Network rules: TLS version, and whether calls must originate from a fixed IP or VPN. Our backend has dynamic outbound IPs, so an IP allowlist would require a design change (static egress or a bank-side exception).

**Required before UAT sign-off**

5. Physical terminal(s) plus the terminal-to-TID pairing procedure and the exact terminal model.
6. OMR currency code confirmation (512) and amount formatting rules (3-decimal baisa).
7. Full host response and decline code list, so donors see correct messages.
8. Timeout, retry and duplicate-charge (idempotency) rules for SALE, plus the reconciliation behaviour of EnquiryByRef.
9. Written confirmation that unattended kiosk operation is certified, and how signature-CVM transactions are handled with no cashier present.

**Operational / commercial**

10. Merchant account and settlement details, batch-close/end-of-day procedure (automatic or ECR-initiated).
11. Refund/void policy and whether the kiosk needs any refund capability.
12. Support contact, escalation path and UAT test-card set.

## Next steps once artefacts arrive

1. Align envelope namespaces and operation names to the WSDL, adjust the parser to the real response fields.
2. Enter UAT credentials in the admin panel for one pilot kiosk and run test-card sales, declines, cancels and a forced-timeout recovery via EnquiryByRef.
3. Verify SMS/WhatsApp receipts and reporting show correct RRN, auth code and masked PAN.
4. Switch the pilot kiosk to production credentials, then roll out kiosk by kiosk.
