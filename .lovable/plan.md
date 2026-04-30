# Keep Kiosk Screen Always On

## Problem
When the kiosk app sits idle, Android dims and turns off the screen, requiring a touch to wake it. The donor experience must show the homepage at all times without interaction.

## Solution
Apply a two-layer approach so the screen stays awake whenever the app is in the foreground, on both the native Android kiosk APK and any browser-based preview.

### 1. Native Android (primary, for the kiosk APK)
Use the official Capacitor community plugin **`@capacitor-community/keep-awake`**, which wraps Android's `WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON`. This is the standard, battery-safe way (it only keeps the screen on while *our* activity is in the foreground — no wake-lock leaks).

- Add dependency: `@capacitor-community/keep-awake`.
- On app startup (in `src/main.tsx`, before React mounts), call `KeepAwake.keepAwake()`.
- Re-assert it on every Capacitor `App` resume event so it survives backgrounding/foregrounding.
- Wrap calls in `try/catch` and a `Capacitor.isNativePlatform()` check (per the project's Android safe-init memory) so the web build never crashes.

### 2. Web fallback (for browser previews / PWA)
Use the browser **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`):

- Request the wake lock on app load.
- Re-request it on `visibilitychange` when the document becomes visible again (browsers auto-release it on tab hide).
- Silently ignore if the API is unavailable (older browsers / iOS Safari < 16.4).

### 3. GitHub Actions Android build
The `.github/workflows/build-android.yml` already runs `npm install` + `npx cap sync android`. Adding the new dependency to `package.json` is enough — Capacitor auto-registers the plugin during sync; no manual `MainActivity.java` edits required.

### 4. Optional polish (no extra plugin)
Add the CSS hint `html, body { -webkit-user-select: none; }` is already implicit; no change needed. We will *not* add Android Immersive/Kiosk mode here — that is a separate request.

## Files to change
- `package.json` — add `@capacitor-community/keep-awake`.
- `src/main.tsx` — initialize keep-awake (native) and screen wake lock (web) before render; re-assert on resume/visibility change.
- (No edits to `capacitor.config.ts`, `MainActivity.java`, or `AndroidManifest.xml` — the plugin handles permissions automatically.)

## Technical notes
- The plugin sets `FLAG_KEEP_SCREEN_ON` on the activity window, so the OS still respects the user pressing the power button but never auto-sleeps.
- This does **not** prevent screen burn-in; if that becomes a concern later we can add a subtle ambient animation, but the existing animated NFC / homepage transitions already mitigate it.
- Memory rule respected: real-time Supabase subscriptions and audio init remain deferred; keep-awake init is synchronous and safe.

## Verification
After merge, install the new APK, leave the kiosk on the homepage for 10+ minutes — the screen should remain fully lit until manually powered off.
