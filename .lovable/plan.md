# Apply the Claude work order — reconciled with fixes already deployed

## Context

The uploaded work order (`Work_order_for_Lovable.pdf`) was reviewed and judged technically sound. Its diagnosis matches our log-based findings: stray `RequestCancellation` traffic landing on in-flight SALEs is the dominant cause of the intermittent `Cancelled By ECR` failures. Several fixes overlap with what is already live (cancel quarantine, enquiry-first stale recovery, lease closing on `rejected`, `terminal_cancelled` classification). This plan applies only the deltas, merging rather than duplicating.

## Section 1 — Failed sessions must not harm the next one

1. **`acquire_apex_terminal_session` migration**: add `'unknown'` to the finished-states list used when a *different* transaction id arrives, so both lists are identical.
2. **Stale-recovery branch**: when enquiry-first recovery says a cancel is needed but `cancelAtTerminal()` fails, dispatch the SALE anyway (logging the failed cancel) instead of returning `stale_session` without dispatching. Safe: ApexECR rejects a SALE while a transaction is genuinely in progress.
3. **`cancelAtTerminal()`**: reduce per-attempt timeout 12000 ms → 4000 ms; cap total pre-SALE cancellation time at 5 seconds. Keep the existing cancel-quarantine behaviour.
4. **`dispatched: boolean`** on every `action: "sale"` response — `true` only after the Sale envelope was actually sent; every early return sets it explicitly to `false`.

## Section 2 — Guaranteed dispatch attempt

5. **`HardwarePosPaymentPage.tsx`**: when the response carries `dispatched: false`, automatically retry once immediately with a **new transaction id** (new invoice number), no error shown to the donor. Only if the retry also returns `dispatched: false` does the donor see a failure (target: within 8 seconds).
6. **`dispatchAttempts`** counter in the sale response. `outcomeUnknown` behaviour stays untouched.

## Section 3 — Warm the correct half of the connection

7. **`warm_probe_mode` kiosk config** (`wsdl` default / `enquiry`): in enquiry mode the warm action sends an `EnquiryByRef` with impossible original references. Default stays `wsdl` until AFS confirms enquiries reach the terminal.
8. **`hardwarePosWarm.ts`**: remove `releaseStale: true` from the 45-second periodic probe; only send it after the kiosk has been idle on the home screen for more than 2 minutes.
9. **Warm handler race guard**: after `claim_stale_apex_session` succeeds and before cancelling, re-read the session row; abort the cancel if the transaction id changed or a newer session is active.
10. **Cold-install fix**: on app launch fetch kiosk config and persist the payment mode *before* starting the readiness loop, so the first donation never runs cold.
11. **Earlier warming**: fire a warm probe on home screen mount and on category selection.

## Section 4 — Correctness fixes

12. **`invoiceNumberFor()`**: replace the 8-hex-chars-mod-1M value (≈39% collision by the 1,000th donation, and `EnquiryByRef` can return the wrong donation's approval) with a per-kiosk monotonic sequence stored server-side. Field width to be confirmed against the ApexECR spec; kept within what the current envelope already sends.
13. **`isApprovedPosResponse()`**: treat `PosRespStatus = -1` as **unknown** (spec meaning), not declined; route to the enquiry/outcome path.
14. **`ConfirmationPage.tsx`**: bind confirm to `onPointerDown` instead of `onClick`.

## Section 5 — Make it provable

15. **`pos_diagnostics` table** (with GRANTs + RLS, service-role write only): transaction_id, correlation_id, kiosk_id, amount_baisas, invoice_number, dispatched, dispatch_attempts, outcome, failure_type, http_status, web_response_status, web_response_error, pos_resp_status, pos_resp_code, session_state_before, seconds_since_previous_attempt, request_to_dispatch_ms, afs_round_trip_ms, created_at. Written after the donor response so it adds nothing to the hot path.
16. **Admin screen**: last 200 rows, filterable by `dispatched` and `failure_type`.

## Section 6 — Acceptance tests (before reporting complete)

1. Idle 10 min → 10 donations: amount appears all 10 times, at most one silent retry each.
2. Burst of 20 donations: all reach the terminal, no two consecutive failures.
3. Fresh install: first donation succeeds on first attempt.
4. Terminal network cut mid-transaction: donor told within 8 s, nothing recorded approved.
5. Poisoned successor: after test 4, the next normal donation dispatches first attempt.

## Explicitly not done (per the work order)

- No changes to SOAP envelope structure, element order, or namespaces.
- Merchant Secure Key stays in `kiosk_secrets`, never logged.
- `warm_probe_mode` stays `wsdl` by default.
- No dispatch before the donor taps Confirm.
- No database roles or external access credentials.

## Technical notes

- Files: `supabase/functions/apex-ecr-payment/index.ts`, `supabase/functions/_shared/apexEcr.ts`, `src/lib/hardwarePosWarm.ts`, `src/pages/kiosk/HardwarePosPaymentPage.tsx`, `src/pages/kiosk/ConfirmationPage.tsx`, `src/App.tsx` (launch warming), one migration for `pos_diagnostics` + the `acquire_apex_terminal_session` fix + the per-kiosk invoice sequence, one new admin page.
- Migrations follow the GRANT-before-RLS policy rules; `pos_diagnostics` is admin-read via authenticated policy, service-role write only.
- The kiosk-side changes (retry, warming, pointer-down) require an APK rebuild and reinstall; backend changes deploy independently.
- After deployment, Section 7 reporting (50-session stats from `pos_diagnostics`) becomes possible and will confirm or refute the residual failure rate.
