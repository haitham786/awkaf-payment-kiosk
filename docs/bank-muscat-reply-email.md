# Reply Email to Bank Muscat — Mosambee CPOC SoftPOS Integration

> Copy the block below into your mail client. Replace the bracketed placeholders
> before sending. No attachments are assumed.

---

**Subject:** Awkaf Donation Kiosk — SoftPOS Integration with Bank Muscat (Mosambee CPOC): Requirements to Begin

**To:** [Bank Muscat Representative Name] <[email@bankmuscat.com]>
**Cc:** [Internal stakeholders / Mosambee integration team, if known]

---

Dear [Representative Name],

Thank you for sharing the *App-to-App Integration Guide v1.17* (Mosambee CPOC Intent Integration). Our technical team has reviewed the document, and we confirm that the Android **intent-based app-to-app** model described is compatible with our existing kiosk application architecture.

**Background.** We operate an Android-based unattended donation kiosk network for Awkaf. The kiosks currently use Thawani Lamsa SoftPOS for contactless donations in Omani Rial (OMR). Following Thawani's discontinuation of the Lamsa SoftPOS service, we are moving to Bank Muscat's SoftPOS solution and would like to begin the integration and certification process at the earliest opportunity.

To move forward, we kindly request the following items from Bank Muscat and Mosambee. We have numbered them so your teams can respond point-by-point:

1. **Mosambee SoftPOS APK** — signed builds for both **Stage** and **Production** environments, together with the exact Android **`package_name`** used in the intent calls (the guide references `<package_name>` as a placeholder).
2. **Cryptographic material for password-token generation** — the **AES-256 key** (and any accompanying public key) that Mosambee will provision for us, and the optional **AAR package** referenced in the "Password Token Generation" section for offline token generation.
3. **Test merchant credentials** — username, PIN, `partnerId`, and the associated MID/TID for the sandbox environment.
4. **Sandbox / Stage environment access** — connectivity details, test cards, and the exact mechanism for switching the Mosambee app between Debug, Stage, and Production modes from the intent call.
5. **Complete response-code catalogue** — including the `SPOCB13` / `CPOCB13` codes and the ISO error codes referenced in the version history of the guide, plus the full list of intent-extra fields returned for **Sale**, **Refund**, **Void**, **Preauth**, **TipComplete**, **PreReceipt**, and **Settlement** (RRN, masked PAN, receipt string, approval code, etc.).
6. **Device and OS requirements** — confirmed minimum Android version (the guide mentions target API 32), NFC and Google Play Services requirements, and confirmation of whether the Mosambee app must be pre-installed and logged in on each kiosk device.
7. **Refund and Void policy** — whether the original RRN / transaction reference is mandatory for Void and Refund operations, session-timeout behaviour, and daily settlement cut-off timing.
8. **Certification path** — UAT test scripts, sign-off criteria, and the go-live approval process (including any Bank Muscat / Mosambee compliance checks we should plan for).
9. **Commercial terms** — MDR, settlement account setup, and confirmation that live settlement in OMR to the Awkaf account is already provisioned (or the steps to provision it).

**Deployment context.** Our kiosks are unattended Android devices equipped with NFC and are currently in production. Once we have the items above, we intend to run a controlled pilot on one or two kiosks in a staging environment, complete UAT with Mosambee, and then roll out to the full fleet.

**Next steps.** We would like to request:

- A **technical kick-off call** between Mosambee's integration team and our development team to walk through the intent flow, environment switching, and certification requirements.
- A **single point of contact** on the Bank Muscat / Mosambee side for technical questions during integration and testing.

Please let us know a convenient time for the call and a suitable channel (email or shared drive) for delivering the APK, keys, and credentials securely.

Thank you for your support. We look forward to working with Bank Muscat on this project.

Best regards,

[Your Full Name]
[Your Title]
[Organisation Name — e.g., Ministry of Endowments and Religious Affairs / Awkaf]
[Phone] | [Email]
[Website, if applicable]
