# No Architecture Change — Credential Path Confirmed Optimal

## Summary
The user asked whether routing Apex credentials through the kiosk app directly (instead of the admin panel / backend) would speed up the hardware POS trigger. The conclusion: no change is required.

## Findings
- The admin panel is only a configuration editor. At payment time it plays no role; the flow is Kiosk app -> apex-ecr-payment edge function -> AFS cloud -> POS terminal.
- Backend SALE dispatch already completes in ~150-450 ms with the DB lookup eliminated by the 10-minute config cache.
- The remaining delay is the AFS network hop (EU Central 2 backend, terminals in Oman) and terminal processing time — unaffected by where credentials are stored.
- Embedding MID/TID/secure key in the kiosk app would expose merchant credentials (APK decompilation / dev tools) with no speed benefit, and would break the established credential-storage security policy.

## Decision
Keep the current architecture unchanged:
- Credentials remain in `kiosk_secrets` / `kiosks.configuration`, stripped from client responses via `get-kiosk-config`.
- Keep-alive, warm-up, and confirmation-time SALE dispatch remain as implemented.

## Work items
None. No code changes will be made.
