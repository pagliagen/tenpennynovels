import type { NextConfig } from 'next';

import { cspReportOnlyHeaders } from '../cspReportOnly.js';

const nextConfig: NextConfig = {
  poweredByHeader: false,

  headers() {
    return Promise.resolve(cspReportOnlyHeaders({ frame: 'https://documenti.tenpennynovels.com' }));
  },
};

export default nextConfig;
