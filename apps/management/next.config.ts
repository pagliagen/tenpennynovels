import type { NextConfig } from 'next';

/**
 * Content-Security-Policy in sola segnalazione (Report-Only): non blocca nulla, il browser manda le violazioni
 * all'api-gateway (`POST /csp-report`, che le scrive nei log). Serve a misurare cosa romperebbe una policy vera
 * prima di applicarla: quando i log sono puliti, cambiare la chiave in `Content-Security-Policy`.
 * Solo in produzione: in sviluppo Next usa eval e script inline per l'hot reload.
 */
const API = 'https://api.tenpennynovels.com';
const WS = 'https://ws.tenpennynovels.com wss://ws.tenpennynovels.com';
const CDN = 'https://cdn.tenpennynovels.com';

function cspReportOnly(extra: { script?: string; connect?: string; frame?: string } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${extra.script ?? ''}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${API} ${WS} ${CDN} ${extra.connect ?? ''}`.trim(),
    `media-src 'self' ${CDN}`,
    `frame-src ${extra.frame ?? "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `report-uri ${API}/csp-report`,
  ].join('; ');
}

const cspHeaders =
  process.env.NODE_ENV === 'production'
    ? [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy-Report-Only', value: cspReportOnly({ frame: 'https://documenti.tenpennynovels.com' }) }] }]
    : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  headers() {
    return Promise.resolve(cspHeaders);
  },
};

export default nextConfig;
