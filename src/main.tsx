import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initKeepAwake } from "./lib/screenWakeLock";
import { prefetchKioskAssets } from "./lib/kioskAssetPrefetch";

// Keep the kiosk screen on as long as the app is in the foreground
try {
  initKeepAwake();
} catch (err) {
  console.warn("[main] keep-awake init failed", err);
}

// Kick off background/logo/category prefetching BEFORE React mounts so the
// network is already in flight by the time KioskHomepage/KioskLayout render.
try {
  prefetchKioskAssets();
} catch (err) {
  console.warn("[main] asset prefetch failed", err);
}

createRoot(document.getElementById("root")!).render(<App />);

