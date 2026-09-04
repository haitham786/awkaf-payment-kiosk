# Roadmap

- [x] Audit OM-A880 v1.22 request framing and response handling
- [x] Correct NBO purchase XML, command codes, checksum validation, and response parsing
- [x] Remove the NBO-only connecting interstitial and dispatch from cached local settings
- [x] Verify the terminal ACK/NAK after each command and retry bounded transmission failures
- [x] Validate the focused changes
- [x] Prevent OM-A880 progress/status responses from prematurely opening payment failure
- [x] Preserve approved transaction recording, receipt flow, and genuine decline handling
- [x] Validate the focused native and kiosk flow changes

- [x] Rebrand NBO payment request screen and remove kiosk-side Cancel control
- [x] Restrict Edit Kiosk to NBO POS and Testing configurations
- [x] Restyle kiosk settings Logout control
- [x] Rename Android workflow and generate launcher icon from Awkaf logo
- [x] Validate UI, workflow syntax, and NBO integration preservation

- [x] Restyle Kiosk Setup login controls and authenticated header
- [x] Remove Payment tab and rename Status to POS Status
- [x] Match on-device OM-A880 POS Status screen to the supplied redesign
- [x] Restyle first-install Settings access without colored icon backgrounds
- [x] Validate the setup-panel changes without altering NBO payment communication

- [ ] Refine confirmation, SMS receipt, success, setup, and NBO payment screen layout
- [ ] Remove legacy Thawani payment pages and route legacy modes safely to NBO
- [ ] Show a bilingual disconnected-terminal error before attempting payment
- [ ] Validate kiosk flows and production build
