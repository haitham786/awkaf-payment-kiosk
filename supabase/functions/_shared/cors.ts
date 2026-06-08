// Shared CORS allowlist for kiosk + admin web origins.
// Used by edge functions that should NOT accept calls from arbitrary origins.

const STATIC_ALLOWED = new Set<string>([
  'https://awkaf-payment-kiosk.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4173',
]);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  // Allow Lovable preview & published subdomains.
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.lovable.app')) return true;
    if (url.hostname.endsWith('.lovableproject.com')) return true;
    // Capacitor / Android WebView origins (kiosk native shell).
    if (url.protocol === 'capacitor:' || url.protocol === 'ionic:') return true;
    if (url.protocol === 'file:') return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = isAllowedOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://awkaf-payment-kiosk.lovable.app',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Vary': 'Origin',
  };
}
