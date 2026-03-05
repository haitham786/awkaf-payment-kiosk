

# Thawani Lamsa SDK Integration Guide for Android Developer

## Summary

The Kiosk app already has the complete web-side integration for Thawani Lamsa. What remains is replacing the **stub** `ThawaniLamsaPlugin.java` with a real implementation that launches the Lamsa SDK Activity and returns results back to the Capacitor bridge. This is approximately 80 lines of Java code.

## What is Already Done (No Changes Needed)

- **Web UI**: Admin panel configures `authKey`, `isProduction`, staging/production toggle
- **Capacitor bridge**: `src/services/thawaniLamsaPlugin.ts` registers `ThawaniLamsa` plugin with full type definitions
- **Web fallback**: `src/services/thawaniLamsaPluginWeb.ts` provides simulation mode for browser testing
- **GitHub Actions**: Build workflow already has steps for Maven repos and copying the plugin file
- **Test Mode**: Fully functional simulation in the browser

## What the Android Developer Needs to Do

### 1. Enable Thawani Maven Repository in GitHub Actions

In `.github/workflows/build-android.yml`, the "Ensure Maven repositories" step needs the Thawani GitHub Packages repo added alongside JitPack:

```text
maven {
    name = "GitHubPackages"
    url = uri("https://maven.pkg.github.com/ThawaniMobile/Lamsa-SDK")
    credentials {
        username = "ThawaniMobile"
        password = "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"
    }
}
```

### 2. Add SDK Dependency

The workflow needs to patch `android/app/build.gradle` to add:
- `dataBinding true` in `buildFeatures`
- `implementation("om.thawani:lamsa.sdk:0.0.22")` in dependencies

### 3. Add Lamsa Activity to AndroidManifest.xml

The workflow's manifest patching step needs to inject:
```xml
<activity
    android:name="om.thawani.lamsa.sdk.LamsaSDK"
    android:parentActivityName=".MainActivity"
    android:theme="@style/Theme.LamsaSDK">
</activity>
```

### 4. Replace the Stub Plugin with Real Implementation

Replace `android-plugin/ThawaniLamsaPlugin.java` with a real implementation that:

- **`isAvailable()`**: Returns `true` (SDK is present)
- **`initialize()`**: Stores `authKey` and `isProduction` from the call
- **`checkNFCStatus()`**: Already implemented correctly in the stub
- **`startPayment()`**: Creates an `Intent` for `LamsaSDK` Activity with `InitOptionsModel(amount, authKey, remarks, isProduction, paymentOption, autoCloseInMillis=3000)`, launches via `startActivityForResult` with request code 200
- **`onActivityResult()`**: Deserializes `PaymentResultModel` from the result intent, maps `success`, `paymentId`, `invoice`, `amount`, `paymentStatus`, `date`, `description` to a `JSObject`, and resolves the saved `PluginCall`
- **`cancelPayment()`**: Finishes any active Lamsa activity

The key mapping from Thawani's `PaymentResultModel` to the Capacitor bridge:

| Thawani Field | Bridge Field |
|---|---|
| `success` | `success` |
| `paymentId` | `thawaniReference` |
| `invoice` | `approvalCode` |
| `description` | `responseMessage` |
| `paymentStatus` (1=Pending, 2=Success, 3=Failed) | `responseCode` |
| `amount` | `amount` |
| `date` | `timestamp` |

### 5. Implementation Plan

I will update three files:

1. **`android-plugin/ThawaniLamsaPlugin.java`** -- Replace stub with real SDK integration (~100 lines of Java). Uses `startActivityForResult` to launch `LamsaSDK`, handles result in `onActivityResult`, and resolves the Capacitor `PluginCall`.

2. **`.github/workflows/build-android.yml`** -- Add Thawani Maven repository credentials, SDK dependency injection, manifest Activity injection, and proguard rules. Enable dataBinding.

3. **`THAWANI_SDK_INTEGRATION.md`** -- Create a comprehensive guide documenting the architecture, what each file does, and how to test.

## Technical Notes

- The plugin uses `@CapacitorPlugin(name = "ThawaniLamsa")` which matches the `registerPlugin('ThawaniLamsa')` call in TypeScript
- `startActivityForResult` is the standard Capacitor pattern for launching native Activities and getting results back
- The `saveCall(call)` / `getSavedCall()` pattern is used to keep the PluginCall alive while the Activity runs
- `autoCloseInMillis = 3000` ensures the Lamsa UI auto-dismisses after payment completes

