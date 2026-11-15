import type { NextConfig } from 'next';

import { cspReportOnlyHeaders, GOOGLE_ANALYTICS } from '../cspReportOnly.js';

const nextConfig: NextConfig = {
  poweredByHeader: false,

  headers() {
    return Promise.resolve(cspReportOnlyHeaders(GOOGLE_ANALYTICS));
  },
};

export default nextConfig;
