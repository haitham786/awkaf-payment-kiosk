# Harden Apex hardware POS communication

## Confirmed diagnosis

- The kiosk is sending the Sale correctly. The latest live attempt reached the backend and was dispatched to AFS in **294 ms**.
- AFS held that request for **36.5 seconds**, then returned HTTP 200 with `WebResponseStatus = Faild`, `PosRespStatus = 0`, and an internal database **pre-login handshake timeout**. The terminal never received that failed request.
- The app currently treats this known pre-dispatch AFS infrastructure failure as a final rejection. It does not retry, so a temporary AFS database connection failure becomes a failed donor session.
- The coordinator correctly prevents overlapping Sales, but `unknown` sessions cannot currently be replaced until their lease expires. Recovery and reconciliation need to distinguish a request that AFS definitively failed before terminal dispatch from a request whose payment outcome is genuinely unknown.
- No application can guarantee communication while the bank/AFS service is unavailable. The app can, however, retry failures that are proven safe, reconcile ambiguous outcomes without duplicate charges, and recover terminal state automatically.

## Implementation

1. **Classify failures by retry safety**
   - Detect AFS internal connection/pre-login handshake timeouts, temporary service-unavailable responses, gateway timeouts, and transport failures separately.
   - Mark only errors proving the Sale was not accepted by the terminal as safe to retry.
   - Keep ambiguous timeouts non-retryable until an enquiry resolves the original reference, preventing duplicate charges.

2. **Add bounded automatic Sale recovery**
   - Retry the same Sale with the same transaction ID, invoice, amount, and reference after short backoff only for safe transient AFS failures.
   - Keep the existing terminal lease throughout recovery so no competing Sale or Cancel can interfere.
   - Limit attempts and total elapsed time; record each attempt and its timing under one correlation ID.

3. **Reconcile uncertain outcomes**
   - For transport aborts or ambiguous AFS replies, run `EnquiryByRef` against the original invoice/reference before releasing the session.
   - Persist approved, declined, failed, or still-unknown results in the terminal session coordinator.
   - Let the kiosk outcome poll continue from the stored result if the original function response is lost.

4. **Make session recovery deterministic**
   - Allow a new Sale to replace a completed or definitively failed session immediately.
   - Preserve genuinely unknown sessions for reconciliation; never send a second financial Sale until the prior outcome is resolved or explicitly cancelled.
   - Ensure late Sale responses cannot overwrite a confirmed cancellation.

5. **Improve kiosk behavior without exposing technical messages**
   - Keep the payment screen active during automatic recovery.
   - Show a concise bilingual terminal-unavailable message only after safe retries/reconciliation are exhausted.
   - Prevent manual Retry while the original outcome remains unknown; allow it immediately after a definitive pre-dispatch failure.

6. **Validate and deploy**
   - Add protocol tests for the exact AFS pre-login timeout, safe retries, exhausted retries, ambiguous timeout enquiry, duplicate invocation, cancellation ownership, and late responses.
   - Run TypeScript/Deno tests, deploy `apex-ecr-payment`, execute non-financial diagnostics, and inspect fresh logs/session state.
   - A controlled attended Sale is still required to prove end-to-end terminal delivery because only the physical AFS terminal can confirm that final hop.

## Expected result

Transient AFS infrastructure failures will be retried automatically without duplicate charging, uncertain outcomes will be reconciled instead of blindly retried, stale state will no longer block later donors, and application-side dispatch will remain in the millisecond range. Persistent AFS/database outages will still require AFS or Ahli Bank intervention, but the correlation/timing logs will identify those failures conclusively.
