# POS Dispatch Diagnosis — What the Logs Actually Show

## Evidence collected (live backend + edge logs, 28 Aug)

Transaction outcomes, last 7 days (152 sales):

| POS response | Meaning | Count |
|---|---|---|
| `05` (no respText, no RRN/STAN) | Sale never completed at the terminal — no card ever read | 133 |
| `uc` | Card Read Error / cancelled by user at terminal | 13 |
| `11` | Not Sufficient Funds (genuine card decline) | 2 |
| `00` | Approved | 4 |

The `05` rows all have `rrn: null`, `stan: null`, `posDate: null` — the terminal never produced a transaction record. These are the "failures" being seen, and they are **not** card declines.

Edge function log lines from live sale attempts:

```text
ApexECR warm      hostReachable: true, sessionState: "unknown", busy: false, ms: 2033
ApexECR expired session recovery
ApexECR sale dispatch   configLookupMs: 2122, requestToDispatchMs: 2126
ApexECR sale response   dispatchToResponseMs: 4238, webResponseStatus: "Faild",
                        webResponseErrorDesc: "Cancelled By ECR", posRespStatus: "0"
ApexECR request failed  failureType: "apex_rejected", httpStatus: 200, elapsedMs: 4237
```

A second attempt seconds later:

```text
ApexECR sale dispatch   configLookupMs: 175, requestToDispatchMs: 178
ApexECR sale response   dispatchToResponseMs: 5264, "Cancelled By ECR"
```

`apex_terminal_sessions` currently holds one row, kiosk `2c50…f`, TID `20063216`, `state = active`, lease still open — i.e. a session left hanging after the last attempt.

## Where the failures originate — ranked

1. **`Cancelled By ECR` from AFS (dominant cause).** AFS accepts the SALE (HTTP 200) and then rejects it as cancelled-by-ECR before the card prompt. This is what produces the `05` rows with null RRN. Trigger: our own CANCEL traffic (UI cancel, session-recovery cancel, stale-lease takeover cancel) racing the SALE on the same TID — AFS applies the cancel to the sale that is arriving, not the previous one.
2. **Cold-start / config lookup jitter.** `configLookupMs` swings from 175 ms to 2122 ms; warm probe took 2033 ms on a cold isolate. This is the 2–3 s felt delay, not the failure itself.
3. **AFS round trip is slow but healthy.** 4.2–5.3 s dispatch-to-response, host reachable, no SOAP timeout, no `busy` response observed in this window.
4. **Lease table leaves sessions `active`.** No duplicate transaction IDs seen; the lease row survives past the attempt and forces "expired session recovery" (which itself issues a cancel) on the next sale — feeding cause 1.

## Proposed fixes

- **Quarantine cancels.** Never issue CANCEL and SALE against the same TID inside a short window. Introduce a cancel cooldown recorded on the session row; a new SALE waits for the terminal to confirm the cancel (or a fixed guard interval) before dispatching, instead of firing recovery-cancel and SALE back to back.
- **Stop the recovery-cancel on sale path.** Replace "expired session recovery → cancel → sale" with an ENQUIRY-first check; only cancel when the enquiry proves a live transaction on the terminal.
- **Always close the lease.** Finalise `apex_terminal_sessions` on every terminal outcome including `apex_rejected`/`Cancelled By ECR`, so no row is left `active`.
- **Classify `Cancelled By ECR` distinctly.** Record it as `terminal_cancelled` rather than a generic failure so the failure rate is measurable, and surface a retry to the donor rather than a dead end.
- **Remove cold-start from the sale path.** Push kiosk terminal config into the warm response and cache it in the isolate for the whole session, so `configLookupMs` is 0 at sale time.

## Technical notes

Files involved: `supabase/functions/apex-ecr-payment/index.ts`, `supabase/functions/_shared/apexEcr.ts`, DB functions `acquire_apex_terminal_session` / `begin_apex_sale` / `finish_apex_terminal_session`, and `src/pages/kiosk/HardwarePosPaymentPage.tsx` for cancel behaviour. Edge log retention is short — a persistent `apex_dispatch_log` table would let us measure the failure rate over days instead of minutes; say if you want that included.
