// Keeps the kiosk screen on as long as the app is in the foreground.
// - On native Android (Capacitor): uses @capacitor-community/keep-awake
//   which sets WindowManager FLAG_KEEP_SCREEN_ON on the activity.
// - On the web/PWA: uses the Screen Wake Lock API and re-acquires it
//   whenever the document becomes visible again.
// Safe to call multiple times. All failures are swallowed.

let webWakeLock: any = null;

const isNative = (): boolean => {
  try {
    // Lazy require so web bundles don't choke if Capacitor isn't present.
    const { Capacitor } = require("@capacitor/core");
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

const enableNative = async () => {
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    await KeepAwake.keepAwake();
  } catch (err) {
    console.warn("[KeepAwake] native enable failed", err);
  }
};

const enableWeb = async () => {
  try {
    if (typeof navigator === "undefined") return;
    const wakeLockApi = (navigator as any).wakeLock;
    if (!wakeLockApi?.request) return;
    webWakeLock = await wakeLockApi.request("screen");
    webWakeLock?.addEventListener?.("release", () => {
      webWakeLock = null;
    });
  } catch (err) {
    // NotAllowedError happens when the page isn't visible/active — safe to ignore.
    console.debug("[KeepAwake] web wake lock not acquired", err);
  }
};

export const enableScreenWakeLock = async () => {
  if (isNative()) {
    await enableNative();
  } else {
    await enableWeb();
  }
};

export const initKeepAwake = () => {
  // Initial activation
  enableScreenWakeLock();

  // Re-acquire on web tab visibility change (browsers auto-release on hide).
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        enableScreenWakeLock();
      }
    });
  }

  // Re-assert on Capacitor app resume (Android backgrounding).
  if (isNative()) {
    import("@capacitor/app")
      .then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) enableNative();
        });
      })
      .catch(() => {
        /* @capacitor/app not installed — fine, web fallback covers it */
      });
  }
};
