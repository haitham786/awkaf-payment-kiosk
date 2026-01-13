import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installBootErrorHandlers } from "@/utils/bootErrorLog";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Install error handlers FIRST before anything else runs
installBootErrorHandlers();

// Create root with error boundary
const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    createRoot(rootElement).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[main] Critical render error:', error);
    // Show basic error on screen
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:white;font-family:system-ui;text-align:center;padding:2rem;">
        <div>
          <h1 style="font-size:1.5rem;margin-bottom:1rem;">خطأ في بدء التشغيل</h1>
          <p style="color:#a1a1aa;margin-bottom:1rem;">حدث خطأ أثناء تحميل التطبيق</p>
          <button onclick="window.location.reload()" style="padding:0.75rem 2rem;background:#16a34a;color:white;border:none;border-radius:0.5rem;cursor:pointer;">
            إعادة المحاولة
          </button>
          <details style="margin-top:1rem;text-align:left;background:#262626;padding:1rem;border-radius:0.5rem;font-size:0.75rem;">
            <summary style="cursor:pointer;color:#a1a1aa;">Error Details</summary>
            <pre style="margin-top:0.5rem;white-space:pre-wrap;color:#ef4444;">${error}</pre>
          </details>
        </div>
      </div>
    `;
  }
} else {
  console.error('[main] Root element not found!');
}
