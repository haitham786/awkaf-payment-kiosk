# Make ApexECR payment sessions reliable

## Confirmed diagnosis

- Sale dispatch from the kiosk reaches the backend quickly (about 150 ms), so the admin panel and configuration lookup are not the current delay.
- Recent logs show overlapping Sale requests for the same TID running in separate backend instances.
- Apex permits only one request per terminal. A later request sees a stale/busy terminal, sends `RequestCancellation`, and can cancel a different Sale that is still in flight. The affected Sale then returns `Cancelled By ECR` after 14–39 seconds.
- The current in-memory promise/cache cannot coordinate separate browsers or backend instances, which explains the intermittent 2/10 success rate.
- The kiosk currently leaves after waiting up to six seconds for Cancel but does not identify the active transaction to the backend.

## Implementation

1. **Add a per-terminal payment-session coordinator**
   - Store one active Apex session per kiosk/TID in the database with transaction ID, state, lease expiry, cancellation request, and timestamps.
   - Expose only backend-only atomic functions to acquire, renew, cancel, and release a terminal session.
   - Keep the table inaccessible to kiosk clients; only backend functions can manage it.

2. **Serialize Sale dispatch safely**
   - Atomically acquire the terminal lease before sending Sale.
   - Return the existing result for duplicate calls using the same transaction ID.
   - Reject a genuinely competing transaction without sending another Sale or cancelling the valid active one.
   - Recover an expired stale session by sending `RequestCancellation`, confirming completion, then acquiring the lease and sending the new Sale once.
   - Release the lease on approval, decline, confirmed cancellation, and definitive Apex rejection; preserve unknown outcomes for enquiry instead of risking a duplicate charge.

3. **Make donor cancellation transaction-aware**
   - Send the current transaction ID with Cancel.
   - Cancel only when that transaction owns the terminal lease, preventing an old page or delayed request from cancelling a newer donor’s payment.
   - Keep the kiosk on a brief “Cancelling” state until Apex acknowledges the command; show a clear error if the terminal does not acknowledge instead of silently claiming success.
   - Ignore any late Sale response after a confirmed donor cancellation.

4. **Remove conflicting lifecycle behavior**
   - Prevent Retry from starting until the previous terminal session is definitively released.
   - Ensure timeout, Cancel, navigation, and duplicate taps converge on the same idempotent cancellation path.
   - Retain pre-warming for network latency, but never let warm calls alter terminal transaction state.

5. **Validate without charging a card**
   - Add protocol and coordinator tests for duplicate Sale, competing Sale, stale lease recovery, owner/non-owner Cancel, late Sale response, timeout, and retry.
   - Deploy the backend function and verify cancellation using the non-financial/live cancel command only.
   - Confirm logs show at most one active Sale per TID and no cross-session cancellation.

## Expected outcome

Every terminal receives at most one Sale command at a time. Duplicate UI/backend invocations become harmless, stale sessions are recovered deterministically, and the donor’s Cancel button clears only that donor’s active terminal prompt. Physical terminal response time after backend dispatch still depends on AFS and the terminal network, but application-side races will no longer cause intermittent non-response.
