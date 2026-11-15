import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

import { cspReportOnlyHeaders } from '../cspReportOnly.js';

const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  headers() {
    return Promise.resolve(
      cspReportOnlyHeaders({
        // Player audio della finestra musica (API iframe di YouTube).
        script: 'https://www.youtube.com https://s.ytimg.com',
        frame: 'https://www.youtube.com https://www.youtube-nocookie.com',
      })
    );
  },
};

export default withAnalyzer(nextConfig);
