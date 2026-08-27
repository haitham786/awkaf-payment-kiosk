# Payment screen clean-up + stuck-after-approval fix

## 1. Tap-card screen (TerminalTapScreen)

- Remove the "terminal network is slow" warning (Arabic + English) and the `slowDispatch` prop/state that feeds it, including the 6-second timer in the payment page.
- Remove the "بانتظار البطاقة… / Waiting for card…" status line. Keep only the cancelling notice while a cancellation is in flight.
- Shrink the Arabic tap instruction so it fits on one line (smaller font size, `whitespace-nowrap`), with the English line scaled to match.
- Payment-method logos become two tidy rows at one consistent scale:
  - Row 1: Visa, Mastercard, Mal, OmanNet (`/images/payment-logos/omannet.svg`)
  - Row 2: Apple Pay, Samsung Pay, Google Pay
  - Visa / Mastercard / Mal / Apple Pay drop to the same height Samsung Pay and Google Pay use today.
- Tighten the frosted card (less padding, smaller tap animation) so it is visibly shorter now that two lines of text are gone.
- Lift the Cancel button off the bottom edge (extra bottom padding, safe-area aware).

## 2. Cancel button actually clears the terminal

Current behaviour: the kiosk waits for Apex to confirm the cancellation (up to two 12s attempts) before doing anything; if confirmation is not returned, the donor is left on an error screen instead of leaving the payment page.

New behaviour:
- Mark the sale result as ignored the moment Cancel is pressed, so a late response can never re-open the flow.
- Send the cancel command to the terminal and return the donor to the kiosk home screen as soon as the terminal acknowledges, or after a short grace period (about 4 seconds) if Apex is slow — the cancel request keeps running in the background.
- Same treatment for the session timeout path.

## 3. Categories page

Remove the `TerminalReadinessBadge` ("جهاز الدفع جاهز / Terminal ready") from the kiosk home/categories screen. The readiness loop itself stays (it keeps the terminal path warm) — only the visible badge goes.

## 4. Stuck after a successful payment

What the data shows: the most recent hardware-POS rows in the database were all written with `success: false`, `responseCode: 05`, and no RRN or auth code, even though the transport call to AFS itself succeeded. So the backend is not recognising the approval in the AFS reply, and the kiosk therefore never routes to the Thank-You / receipt screen. A second failure mode is possible on long taps: if the edge response is lost in transit, the kiosk keeps waiting with no fallback.

Fix, in two parts:

1. **Approval detection**: broaden the approval test in the shared Apex parser — accept `PosRespStatus` values of `1`/`true`/`approved` and, when the status field is absent or ambiguous while an approval response code (`00`/`000`) or an auth code/RRN is present, treat it as approved. Log the raw AFS reply (with the PAN masked) on any non-approved outcome so the exact field names AFS returns are captured for confirmation.
2. **Outcome recovery**: when the sale reply is inconclusive, the edge function runs an `EnquiryByRef` on the same invoice before answering, so the terminal's own record decides the outcome. On the kiosk side, if the sale invocation has not returned after a few seconds, poll the transaction outcome (terminal session result for that transaction id) and navigate to the Thank-You page as soon as an approved result exists — so a lost response can no longer strand the donor on the tap screen.

Approved transactions continue through the existing recording path, so the reference number, SMS/WhatsApp receipt and reporting behave exactly as before.

## Files touched

- `src/components/kiosk/TerminalTapScreen.tsx` — layout, text, logos, spacing
- `src/pages/kiosk/HardwarePosPaymentPage.tsx` — cancel/timeout behaviour, remove slow-dispatch, outcome polling
- `src/pages/kiosk/KioskHomepage.tsx` — remove the readiness badge
- `supabase/functions/_shared/apexEcr.ts` — approval detection + raw-reply diagnostics
- `supabase/functions/apex-ecr-payment/index.ts` — enquiry-based outcome confirmation

Note: these changes take effect in the Android kiosk only after a new APK build.
