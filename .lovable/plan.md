# Kiosk payment-screen and homepage polish

## Scope
Update only the kiosk presentation and decline-page timing. Keep the existing Apex sale, enquiry, cancel, terminal pairing, and request logic unchanged.

## Changes

1. **Connecting screen**
   - Reduce the interstitial duration from 3 seconds to 2 seconds.
   - Replace the current double/green spinner treatment with one black rotating ring.
   - Remove the translucent white panel so the spinner and bilingual prompt float directly over the administrator-selected background.
   - Slightly reduce the Arabic prompt size and keep it on one line within narrow kiosk screens.

2. **Declined-payment flow**
   - Remove the Try Again and Cancel buttons from the transaction-declined page.
   - Keep the failure message visible for 2 seconds, then automatically replace the route with `/kiosk` so the donor starts again from the categories page.
   - Leave the separate communication-error interface and its safety behavior unchanged.

3. **Hardware POS payment-request screen**
   - Add OmanNet alongside Visa, Mastercard, and Mal.
   - Add the supplied Ahli Islamic logo below the payment frame.
   - Add a compact “Powered By” lockup with the supplied AFS logo below Ahli Islamic.
   - Raise the tap-card frame and balance spacing so the partner marks remain clear of the Cancel button on the 360×800 target.
   - Store both supplied logos through the project asset flow; create the required square Ahli Islamic favicon copy when placing the brand mark.

4. **Categories homepage**
   - Keep Visa, Mastercard, OmanNet, and Mal on the first payment-method row.
   - Add a smaller second row for Apple Pay, Samsung Pay, and Google Pay.
   - Lower and compact the payment-logo area while preserving enough category-grid height for two additional administrator-created categories.

## Validation
- Verify the 2-second connecting and declined-page transitions.
- Check the payment-request and categories layouts at the 360×800 kiosk viewport, including logo rows, spacing, single-line Arabic prompt, and Cancel-button separation.
- Confirm the existing hardware-POS invocation and cancellation code has no functional changes.
