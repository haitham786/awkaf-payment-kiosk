# Always-ready terminal link (kiosk ↔ hardware POS)

## Where things stand

The race conditions are fixed and deployed: the backend now takes an atomic per-terminal lease before every Sale (`acquire_apex_terminal_session`), releases it on every outcome (`finish_apex_terminal_session`), and Cancel only acts on the donor's own transaction. Overlapping sales can no longer cancel each other.

What is not solved, and cannot be solved as literally asked: there is no permanent open socket between the kiosk and the terminal. AFS/Apex is a request/response web service — the kiosk asks the cloud, the cloud pushes the amount to the terminal over the bank network. Nothing in the published integration allows a session to be held open. So "never lose connection" has to be delivered as **always ready to dispatch in milliseconds**, not as a literal permanent link.

## What to build

1. **Idle readiness loop (the practical "full-time connection")**
   - While the kiosk sits on Home / Category / Amount screens, run a low-frequency readiness probe that keeps the backend isolate hot and the TLS route to AFS open.
   - The probe never touches transaction state, and pauses completely once a payment session starts, so it can never compete with a real Sale.
   - Back off automatically when the screen is off, offline, or a probe fails repeatedly; recover instantly on focus/online.

2. **Terminal readiness indicator**
   - Show a small live status on the kiosk (Ready / Reconnecting / Terminal busy) driven by the last probe result plus the coordinator's current session state.
   - If the terminal is stuck in someone else's session, say so before the donor picks an amount instead of failing after confirmation.

3. **Automatic idle recovery of stuck terminals**
   - When a probe finds a session whose lease has expired, clear it from the idle screen — cancel-and-release while nobody is paying, so the next donor never meets "Another transaction under processing".
   - Bounded retries, logged, never run during an active session.

4. **Zero-wait dispatch on confirmation**
   - Keep the Sale firing at the confirmation tap (already the case) and make the payment screen render from the pre-warmed state, so backend time stays in the ~150–250 ms range measured in the logs.
   - If dispatch takes longer than a set threshold, surface it as a terminal/network condition rather than a silent wait.

5. **Prove it with instrumentation, not a card**
   - Log timing stages (lease acquired, SOAP sent, AFS replied) per attempt with the correlation id.
   - Run repeated dispatch/cancel cycles against the live terminal using the non-financial cancel/diagnose commands and confirm consistent readiness across attempts.

## Honest expectation

App-side time becomes near-constant and the terminal will be prompted on every attempt. The remaining seconds you see on the terminal screen are AFS/bank-network transit inside Oman and are outside this application; if measurements show that is still 3+ seconds, the timing logs will give you the exact evidence to hand to AFS/Ahli.

## Technical notes

- Frontend: `src/lib/hardwarePosWarm.ts` (readiness loop + backoff), `src/pages/kiosk/HardwarePosPaymentPage.tsx`, kiosk idle screens for the status chip.
- Backend: `supabase/functions/apex-ecr-payment/index.ts` — extend the existing `warm` action to report coordinator session state and support idle-only stale-session release.
- No schema change needed; the existing `apex_terminal_sessions` coordinator already carries state and lease expiry.
