# Plan: Draft reply email to Bank Muscat

No code or database changes. Deliverable is a single ready-to-send email you can copy into your mail client (or forward to Bank Muscat as-is), based on the "App-to-App Integration Guide v1.17" (Mosambee CPOC Intent Integration) they sent.

## Deliverable

A concise, professional email covering:

1. **Acknowledgement** — confirm we've reviewed the v1.17 spec and that the Android **Intent-based app-to-app** model is compatible with our kiosk application.
2. **Context** — one short paragraph explaining that we're migrating from Thawani Lamsa SoftPOS to Bank Muscat's SoftPOS on unattended Android donation kiosks operating in OMR.
3. **Items requested to begin integration** (clearly numbered so Bank Muscat / Mosambee can respond point-by-point):
   1. Mosambee SoftPOS **APK** for stage and production, plus the exact Android **`package_name`** used in the intent calls.
   2. **AES-256 encryption key** (and any public key) for password-token generation, and the **AAR package** referenced in section "Password Token Generation" for offline token generation.
   3. **Test merchant credentials**: username, PIN, `partnerId`, MID/TID.
   4. **Sandbox / Stage environment** access, test cards, and instructions for switching between Debug / Stage / Production from the intent call.
   5. **Complete response-code catalogue** (including `SPOCB13`/`CPOCB13` and ISO error codes referenced in the version history) and the full list of intent-extra fields returned for Sale, Refund, Void and Settlement (RRN, masked PAN, receipt string, etc.).
   6. **Device / OS requirements** — confirmed minimum Android version, NFC and Google Play Services requirements, and whether the Mosambee app must be pre-installed and logged in per device.
   7. **Refund / Void policy** — whether original RRN/txn reference is required, and settlement cut-off timing.
   8. **Certification path** — UAT test scripts, sign-off criteria, and go-live approval process.
   9. **Commercial** — MDR, settlement account setup, and confirmation OMR live settlement to the Awkaf account is provisioned.
4. **Deployment context** — brief note that our kiosks are unattended Android devices with NFC, currently in production with Thawani Lamsa, and we plan a controlled pilot on 1–2 kiosks before full rollout.
5. **Next steps** — request a technical kick-off call between Mosambee's integration team and our development team, and a single point of contact for technical questions.
6. **Signature block** — placeholder fields for your name, title, organisation, and contact details.

## Format

Plain email body (subject line + greeting + numbered request + closing). Neutral, professional tone. English. No attachments assumed.

## Where the draft will live

Saved as `docs/bank-muscat-reply-email.md` in the project so you can copy it out easily and we retain a record. No source code, no `.env`, no database, no edge functions touched.
