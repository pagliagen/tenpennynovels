import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

import { cspReportOnlyHeaders, GOOGLE_ANALYTICS } from '../cspReportOnly.js';

const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,

  // Nginx manda X-Frame-Options: SAMEORIGIN su tutto il dominio (vedi
  // deploy/nginx-configs/documenti.tenpennynovels.com.conf) — bloccherebbe
  // l'iframe di preview da gestione.tenpennynovels.com. I browser moderni
  // danno precedenza a CSP frame-ancestors quando presente insieme a XFO,
  // quindi basta questo header qui: nessuna modifica Nginx richiesta.
  headers() {
    return [
      ...cspReportOnlyHeaders(GOOGLE_ANALYTICS),
      {
        source: '/preview/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://gestione.tenpennynovels.com http://localhost:4003",
          },
        ],
      },
    ];
  },
};

export default withAnalyzer(nextConfig);
