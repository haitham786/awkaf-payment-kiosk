import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initKeepAwake } from "./lib/screenWakeLock";

// Keep the kiosk screen on as long as the app is in the foreground
try {
  initKeepAwake();
} catch (err) {
  console.warn("[main] keep-awake init failed", err);
}

createRoot(document.getElementById("root")!).render(<App />);
