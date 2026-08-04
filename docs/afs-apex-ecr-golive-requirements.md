# ApexECR Go-Live Requirements — Ahli Bank / Arab Financial Services (AFS)

**Project:** Awkaf Donation Kiosk — hardware POS (EFTPOS) integration over ApexECR web service
**Status:** Integration developed and deployed on our side. Blocked on bank artefacts below.

---

## 1. What is already complete on our side

- Backend service handling ApexECR `SALE`, `EnquiryByRef` (recovery/reconciliation) and `CancelLastRequest`.
- SOAP request construction and response parsing (WebResponseStatus, PosRespStatus, PosRespCode, PosRRN, PosAuthCode, masked PAN, batch/STAN, receipt text).
- Transactions recorded in our reporting pipeline with server-side protection against forged sales from the device.
- Donor-facing screens: "tap your card on the terminal", approved, declined, error, cancel and timeout handling.
- Admin panel: per-kiosk Hardware POS mode with Service URL, MID, TID, currency code and timeout. The Merchant Secure Key is stored server-side only and is never transmitted to the kiosk device.
- Receipts continue to be delivered by SMS/WhatsApp; terminal paper receipt printing is disabled (`EnablePrintPosReceipt = 0`).

---

## 2. Hard blockers — required to begin UAT

| # | Item | Why it is needed |
|---|------|------------------|
| 1 | **WSDL file** (Appendix A of ApexECR Web Service Integration v1.08) | Confirms exact SOAP namespaces, operation names, SOAPAction headers and field casing. Our envelopes are currently built against assumed values. |
| 2 | **UAT and production endpoint URLs** | Required to route requests; must be HTTPS. |
| 3 | **Test MID, TID and Merchant Secure Key** (and later the production set) | Required to authenticate every transaction request. |
| 4 | **Network access rules** — TLS version, and whether requests must originate from a fixed IP or VPN | Our backend uses dynamic outbound IPs. If an IP allowlist is mandatory, we need either a bank-side exception or advance notice so we can provision static egress. This can change the architecture, so please confirm early. |

---

## 3. Required before UAT sign-off

5. **Physical terminal(s)**, the exact terminal model AFS will supply, and the terminal-to-TID pairing procedure.
6. **Currency confirmation:** OMR numeric code (we assume 512) and amount formatting rules (3 decimal places / baisa).
7. **Full host response and decline code list**, so donors are shown accurate messages in Arabic and English.
8. **Timeout, retry and duplicate-charge (idempotency) rules for SALE**, plus the exact behaviour of `EnquiryByRef` when the original response was lost. Confirm whether our derived ECR invoice number is an acceptable reconciliation key.
9. **Written confirmation that unattended kiosk operation is certified**, and the required handling of signature-CVM transactions with no cashier present (ideally: force PIN/no-CVM, or a floor limit).

---

## 4. Operational and commercial items

10. Merchant account and settlement details; batch-close / end-of-day procedure (terminal-automatic or ECR-initiated).
11. Refund and void policy — whether the kiosk needs any refund capability or whether refunds are handled at the branch.
12. Support contact and escalation path for UAT and production, plus a set of UAT test cards.

---

## 5. Our next steps once the above is received

1. Align SOAP namespaces, operation names and response parsing to the supplied WSDL.
2. Load UAT credentials into one pilot kiosk and execute: approved sale, declined sale, cancel mid-transaction, and a forced-timeout reconciliation via `EnquiryByRef`.
3. Verify SMS/WhatsApp receipts and admin reporting show correct RRN, auth code and masked PAN.
4. Switch the pilot kiosk to production credentials, then roll out kiosk by kiosk.

Estimated effort after artefacts are received: 2–3 working sessions, plus UAT turnaround with the bank.
