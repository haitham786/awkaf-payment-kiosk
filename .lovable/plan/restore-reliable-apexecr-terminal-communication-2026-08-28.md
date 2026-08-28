# Restore reliable ApexECR terminal communication

## Confirmed cause
- The live AFS endpoint and WSDL are reachable and match the implemented `Sale`, `RequestCancellation`, and `EnquiryByRef` operations.
- The current live request is rejected by AFS with `Invalid Secure Key` before it can reach the POS.
- The stored key is 47 characters and includes copied label text/whitespace; Apex requires the 32-character hexadecimal Merchant Secure Key token.

## Implementation
1. Normalize the existing stored credential to its embedded 32-character hexadecimal token without exposing it.
2. Normalize and validate Merchant Secure Keys when administrators save kiosk settings; reject malformed values instead of storing them.
3. Add the same normalization/validation at the payment backend boundary so old copied formats cannot silently break payments.
4. Ensure a successful terminal approval is persisted and returned immediately to the kiosk, preserving navigation to the success/receipt flow.
5. Add protocol tests for valid, copied/labeled, and invalid key formats.
6. Deploy the payment function and run a non-financial live diagnostic to verify AFS accepts the credential.

## Acceptance checks
- Apex protocol tests pass.
- Live WSDL remains reachable.
- Live SOAP diagnostic no longer returns `Invalid Secure Key`.
- The frontend build/type checks pass automatically.
- No real SALE is initiated during automated validation; the physical terminal amount display and sub-second final hop require a controlled test transaction on the paired device.
