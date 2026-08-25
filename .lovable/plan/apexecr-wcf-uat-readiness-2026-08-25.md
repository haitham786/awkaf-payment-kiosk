# ApexECR (WCF) UAT Readiness

## Short answer

Yes — the integration is built and it is already written for a Microsoft WCF service. The backend function sends SOAP 1.1 envelopes to `tempuri.org` with `SOAPAction: http://tempuri.org/IApexEcr/<Operation>` and WCF-style data-contract element blocks, which is exactly the shape a WCF `basicHttpBinding` endpoint expects.

What is not yet proven is whether the *details* match your specific UAT endpoint, because those come from the WSDL we still do not have. The three things that typically break a first WCF call:

1. **Binding type** — if AFS exposes `wsHttpBinding` or `basicHttpsBinding` with SOAP 1.2, the content type must be `application/soap+xml` with an `action=` parameter, and a WS-Addressing `<To>`/`<Action>` header is required. We currently send SOAP 1.1 only.
2. **Data contract namespace** — WCF derives it from the .NET namespace of the request class (e.g. `http://schemas.datacontract.org/2004/07/ApexEcr.Models`). Ours is configurable but currently defaults to the base without the class namespace. A wrong value makes WCF silently deserialise every field as null.
3. **Element order** — WCF `DataContractSerializer` requires members in alphabetical order. Our `Config` and `Printer` blocks are alphabetical, but the top-level members (`TransactionType`, `EcrAmount`, `InvoiceNumber`) are not, so those may be rejected.

## Plan to make UAT succeed on the first day

### 1. Auto-discover the contract from the UAT endpoint
Add a `probe` action to the payment function that fetches `?wsdl` and `?singleWsdl` from the configured service URL and returns the extracted `targetNamespace`, data-contract namespaces, binding type (SOAP 1.1 vs 1.2), operation names and SOAPAction values. This turns "guess the contract" into "read the contract" the moment you have the URL.

### 2. Support SOAP 1.2 / WS-Addressing
Extend the shared helper so a per-kiosk `soap_version` setting (1.1 default, 1.2 optional) switches the content type to `application/soap+xml; charset=utf-8; action="..."` and injects WS-Addressing `<wsa:Action>` and `<wsa:To>` headers. No code change needed at go-live — just a setting.

### 3. Correct member ordering and namespace handling
Emit all data-contract members in alphabetical order and allow the data-contract namespace to be set per kiosk (already partly supported) with a sensible WCF default.

### 4. Surface WCF faults properly
Parse `<s:Fault>` / `<faultstring>` / `<detail>` and return the real fault text to the admin instead of a generic "Terminal request failed", so a namespace or contract mismatch is instantly diagnosable during UAT.

### 5. Admin "Test Connection" panel
Extend the existing Verify Terminal control in Manage Kiosks with a diagnostics view: run the probe, show the discovered namespaces/operations, and offer a one-click "apply discovered settings to this kiosk".

## Technical notes

- Files touched: `supabase/functions/_shared/apexEcr.ts` (SOAP version, ordering, fault parsing), `supabase/functions/apex-ecr-payment/index.ts` (probe action, fault surfacing), `src/pages/admin/KiosksManagement.tsx` (diagnostics UI).
- New optional per-kiosk config keys under `hardware_pos`: `soap_version`, `contract_name`, plus the existing `tem_namespace` / `data_namespace`.
- No schema migration required; all new settings live in the existing kiosk configuration JSON. The Merchant Secure Key stays in `kiosk_secrets` and never reaches the device.
- Egress IP remains dynamic — if UAT sits behind an IP allowlist, that still needs a bank-side exception.
