# Remove ApexECR sale dispatch delay

## Diagnosis
- A stale-session flag currently forces a cancellation before every affected sale.
- That pre-sale cancellation retries twice with a 12-second timeout, so it can block the SALE for about 25 seconds before the amount is sent.
- The sale function also scans all other kiosk configurations on every request, despite the database already enforcing unique terminal pairing.

## Changes
1. Send every valid SALE immediately after loading only the current kiosk and its secret; remove the all-kiosk scan from the hot path.
2. Remove the blocking pre-sale cancellation. Cancellation remains an explicit donor action and will report whether the terminal accepted it.
3. Clear local stale-session state only after a confirmed cancel, approval, or definitive decline; do not falsely mark a failed cancellation as complete.
4. Add safe timing logs around configuration loading and SOAP dispatch so any remaining delay can be separated into app/backend time versus AFS response time.
5. Deploy and invoke the backend function to verify the new path returns without the pre-sale-clear delay.

## Expected result
The SOAP SALE is dispatched as soon as the payment screen opens, without waiting up to 25 seconds for a cancellation request or scanning unrelated kiosks.
