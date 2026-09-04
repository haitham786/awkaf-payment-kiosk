# Kiosk View Refinements

## Changes
- Remove both confirmation-button arrows, increase button height slightly, and make the Arabic donation amount label black.
- Reduce the payment request frame and Arabic instruction sizes while keeping all content contained.
- Make the SMS keypad buttons square, match the manual amount keypad sizing, and narrow their translucent container.
- Shorten and compact the thank-you content, move the category/amount upward, and add clearer spacing above the Yes button.

## Technical details
- Limit changes to the four kiosk presentation components; payment routing and NBO terminal logic remain unchanged.
- Verify the affected views at the kiosk's compact mobile dimensions and run focused project validation.