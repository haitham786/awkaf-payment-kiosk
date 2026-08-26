# Restore ApexECR hardware POS communication

## Confirmed diagnosis

- The kiosk is correctly configured to use Hardware POS and reaches the `apex-ecr-payment` backend function.
- The stored configuration has the expected AFS credential shapes: 8-character TID, 15-character MID, 32-character merchant key, OMR currency code `512`, and the production AFS service host.
- The live AFS WSDL is reachable from the backend and confirms the deployed contract uses `Sale`, `RequestCancellation`, and `EnquiryByRef` with the current SOAP actions.
- Actual SOAP POST traffic is failing before a terminal response is returned. The backend log records **`ApexECR HTTP 522 (HTML/WAF response)`**. This indicates the AFS/Cloudflare service is timing out or blocking the backend-to-AFS request path; it is not evidence of an incorrect MID/TID/key.
- The admin “Verify Terminal” action is currently unreliable: it sends an enquiry without the original RRN required by the Apex specification, while the backend labels the call successful even when Apex did not confirm the terminal.
- The kiosk receives gateway failures as HTTP 200 payloads, and current diagnostics discard useful Apex/WAF details, making the session appear to wait without a clear actionable explanation.

## Implementation

1. **Align SOAP payloads with the live AFS contract**
   - Re-read the live imported XSDs and encode the exact `SaleRequest`, `EcrConfig`, and `EcrPrinter` element names, namespaces, types, and order.
   - Keep the confirmed production SOAP actions and service address.
   - Add protocol tests for Sale, cancellation, enquiry, amount conversion, XML escaping, and response/fault parsing using sanitized fixtures.

2. **Replace the misleading terminal verification**
   - Change “Verify Terminal” into a non-financial connectivity/configuration test that checks WSDL reachability and sends a safe Apex request agreed by the contract.
   - Treat WAF HTML, SOAP faults, HTTP failures, credential rejection, unknown status, and terminal non-response as failures—not as successful verification.
   - Show separate results for service reachability, SOAP acceptance, credential/pairing acceptance, and terminal availability.

3. **Make every failure visible and traceable**
   - Preserve safe diagnostics from the AFS response: HTTP status, content type, SOAP fault, `WebResponseStatus`, `WebResponseErrorDesc`, `PosRespStatus`, response code/text, elapsed time, operation, and a generated correlation ID.
   - Never log or return the merchant key, full request XML, or card data.
   - Return meaningful status/error payloads to the kiosk and immediately show a bilingual error with Retry and Cancel instead of silently waiting.

4. **Harden the sale lifecycle**
   - Add an idempotent transaction state before dispatch so retries cannot create duplicate charges.
   - Distinguish definitive rejection from unknown/timeout. For unknown outcomes, run recovery enquiry by the original ECR reference instead of automatically submitting a second Sale.
   - Ensure UI timeout and backend timeout do not race or issue cancellation after an already completed transaction.

5. **Resolve the confirmed AFS network blocker**
   - Produce a concise AFS/Ahli Bank escalation package containing the service hostname, UTC timestamps, HTTP 522 result, backend egress region/context, SOAP action, TID/MID lengths, and correlation IDs—without credentials.
   - Ask AFS to confirm that cloud-origin SOAP POST requests are allowlisted/routed to ApexECR and that the supplied TID is online, activated, and mapped to the same MID/merchant key in the selected production tenant.
   - Keep the app reporting “AFS service unreachable/blocked” until AFS resolves this external path; application code cannot bypass their WAF or activate an unprovisioned terminal.

6. **Validate end to end**
   - Deploy the corrected function and test WSDL, safe verification, malformed credentials, SOAP faults, timeout recovery, and cancellation.
   - Run one controlled minimum-value production Sale only when the physical terminal is attended and AFS confirms the route is open.
   - Verify that the amount appears on the paired terminal, approval/decline returns to the kiosk, the transaction is recorded once, and no sensitive values appear in logs or UI.

## Expected outcome

The app will accurately identify whether the failure is connectivity/WAF, SOAP contract, credentials/pairing, terminal availability, or transaction rejection. Once AFS permits the SOAP POST path and confirms terminal provisioning, the Sale request will trigger the paired hardware POS and return a reliable result to the kiosk.
