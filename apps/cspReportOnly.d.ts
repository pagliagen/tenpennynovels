export interface CspExtraOrigins {
  script?: string;
  connect?: string;
  frame?: string;
}

export interface CspHeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

export function cspReportOnlyHeaders(extra?: CspExtraOrigins): CspHeaderRule[];
export const GOOGLE_ANALYTICS: CspExtraOrigins;
