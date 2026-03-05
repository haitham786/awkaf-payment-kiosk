# Thawani Lamsa SDK Integration Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  React/TypeScript (Capacitor Web Layer)         │
│                                                 │
│  softPosService.ts → thawaniLamsaPlugin.ts      │
│       ↓ registerPlugin('ThawaniLamsa')          │
├─────────────────────────────────────────────────┤
│  Capacitor Bridge                               │
├─────────────────────────────────────────────────┤
│  ThawaniLamsaPlugin.java (Native Android)       │
│       ↓ startActivityForResult                  │
│  om.thawani.lamsa.sdk.LamsaSDK (Activity)       │
│       ↓ PaymentResultModel                      │
│  handlePaymentResult → resolve(JSObject)        │
└─────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `android-plugin/ThawaniLamsaPlugin.java` | Native Capacitor plugin that launches LamsaSDK |
| `src/services/thawaniLamsaPlugin.ts` | TypeScript interface + Capacitor plugin registration |
| `src/services/thawaniLamsaPluginWeb.ts` | Web fallback (simulation mode for browser testing) |
| `src/services/softPosService.ts` | High-level service used by UI components |
| `.github/workflows/build-android.yml` | Build pipeline that injects SDK dependency |

## SDK Reference

- **Documentation**: https://thawani.gitbook.io/lamsa
- **Maven**: `om.thawani:lamsa.sdk:0.0.22`
- **Repository**: `https://maven.pkg.github.com/ThawaniMobile/Lamsa-SDK`

## Payment Flow

1. Admin configures `authKey` + environment (staging/production) in Kiosk Settings
2. Kiosk app calls `softPosService.startPayment(amount, transactionId)`
3. `thawaniLamsaPlugin.ts` calls native `ThawaniLamsaPlugin.startPayment()`
4. Plugin creates `InitOptionsModel` and launches `LamsaSDK` Activity
5. User taps NFC card on device screen
6. SDK returns `PaymentResultModel` via `onActivityResult`
7. Plugin maps result to `JSObject` and resolves the Capacitor `PluginCall`
8. TypeScript receives `ThawaniPaymentResult` and updates transaction

## Field Mapping

| Thawani SDK (`PaymentResultModel`) | Capacitor Bridge (`JSObject`) | TypeScript (`ThawaniPaymentResult`) |
|---|---|---|
| `success` | `success` | `success` |
| `paymentId` | `thawaniReference` | `thawaniReference` |
| `invoice` | `approvalCode` | `approvalCode` |
| `description` | `responseMessage` | `responseMessage` |
| `paymentStatus` (1=Pending, 2=Success, 3=Failed) | `responseCode` | `responseCode` |
| `amount` | `amount` | _(mapped)_ |
| `date` | `timestamp` | `timestamp` |

## InitOptionsModel Parameters

```java
new InitOptionsModel(
    amount,           // double - amount in OMR
    authKey,          // String - Tajer authentication key
    remarks,          // String - transaction description
    isProduction,     // boolean - false=staging, true=production
    1,                // paymentOption - 1 = NFC tap
    3000              // autoCloseInMillis - auto-dismiss after payment
);
```

## Build Requirements

The GitHub Actions workflow automatically:
1. Adds Thawani Maven repository with credentials
2. Enables `dataBinding` in `buildFeatures`
3. Adds `implementation("om.thawani:lamsa.sdk:0.0.22")` dependency
4. Registers `LamsaSDK` Activity in AndroidManifest.xml
5. Copies `ThawaniLamsaPlugin.java` to the correct package directory
6. Registers the plugin in `MainActivity`

## Testing

### Test Mode (Browser)
- Toggle "Test Mode" in Admin → Kiosk Settings → Soft POS
- Payments are simulated with 90% success rate
- No native SDK or NFC hardware required

### Staging Mode (Device)
- Set environment to "Staging" in Admin panel
- Use Thawani-provided test auth key
- Requires NFC-capable Android device

### Production Mode (Device)  
- Set environment to "Production" in Admin panel
- Use production auth key from Thawani
- Real card transactions will be processed

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `SDK_NOT_AVAILABLE` | Ensure SDK dependency is in build.gradle |
| `NOT_INITIALIZED` | Call `initialize()` before `startPayment()` |
| `NFC_DISABLED` | Enable NFC in Android Settings |
| `CANCELLED` | User cancelled or Activity returned no result |
| `NO_RESULT` | SDK Activity finished without PaymentResultModel |
