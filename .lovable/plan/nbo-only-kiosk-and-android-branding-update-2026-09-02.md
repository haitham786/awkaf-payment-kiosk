# NBO-only kiosk and Android branding update

## Changes
- Rebrand the NBO payment request screen: remove Ahli/AFS branding and the kiosk Cancel control, slightly narrow the white payment frame, and place the supplied NBO SVG at a balanced size beneath it.
- Restyle the kiosk settings Logout control as a light text-and-icon button.
- Reduce Edit Kiosk payment choices to only National Bank of Oman (NBO) POS Terminal and Testing; remove legacy Thawani, gateway, and Ahli/Apex configuration controls and prevent those retired configurations from being saved.
- Rename the GitHub Android workflow to “Awkaf Donation Platform” and remove retired Thawani/Apex build wiring while retaining the NBO USB plugin, USB manifest configuration, and verification.
- Generate Android launcher/adaptive icon resources from the supplied Awkaf PNG during the workflow.

## Technical details
- Preserve the existing `NboEcr` purchase/cancel/result parsing, transaction recording, receipt routing, USB IDs, and native Java bridge unchanged.
- Keep compatibility for reading existing kiosk records, but normalize retired payment modes to NBO in the edit form.
- Use CDN asset pointers for the supplied NBO SVG in the web UI; the Awkaf PNG will be consumed by the Android build workflow to generate launcher resources.
- Validate the focused frontend behavior and workflow syntax after editing.
