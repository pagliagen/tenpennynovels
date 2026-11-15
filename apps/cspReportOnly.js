/**
 * Content-Security-Policy in sola segnalazione (Report-Only), condivisa dai `next.config.ts` delle quattro app.
 *
 * Non blocca nulla: il browser manda le violazioni all'api-gateway (`POST /csp-report`, che le scrive nei log).
 * Serve a misurare cosa romperebbe una policy vera prima di applicarla: a log puliti, cambiare la chiave in
 * `Content-Security-Policy`. Solo in produzione: in sviluppo Next usa eval e script inline per l'hot reload.
 *
 * File JavaScript semplice e fuori dalle cartelle delle app di proposito: il repo non ha workspace, e un `require`
 * relativo è l'unico modo di non copiare la policy quattro volte. Non è una cartella perché deploy e install
 * iterano su `apps/<cartella>/`.
 */
const API = 'https://api.tenpennynovels.com';
const WS = 'https://ws.tenpennynovels.com wss://ws.tenpennynovels.com';
const CDN = 'https://cdn.tenpennynovels.com';

/**
 * @param {{ script?: string, connect?: string, frame?: string }} [extra] origini in più per questa app
 * @returns {{ source: string, headers: { key: string, value: string }[] }[]}
 */
function cspReportOnlyHeaders(extra = {}) {
  if (process.env.NODE_ENV !== 'production') return [];

  const policy = [
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

  return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy-Report-Only', value: policy }] }];
}

/** Google Analytics: usato da landing e documents. */
const GOOGLE_ANALYTICS = {
  script: 'https://www.googletagmanager.com',
  connect: 'https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com',
};

module.exports = { cspReportOnlyHeaders, GOOGLE_ANALYTICS };
