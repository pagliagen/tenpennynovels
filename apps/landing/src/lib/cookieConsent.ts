/**
 * Shared cookie / analytics consent storage (GDPR-oriented).
 * Used by CookieBanner, AnalyticsGate, and Web Vitals reporting.
 */
export const COOKIE_CONSENT_STORAGE_KEY = 'tpn_cookie_consent';

/** Value stored when the user accepts cookies (essential + optional analytics). */
export const COOKIE_CONSENT_ACCEPTED = 'accepted';

/** Dispatched on document after the user accepts; AnalyticsGate listens for it. */
export const COOKIE_CONSENT_EVENT = 'tpn-cookie-consent-accepted';

export function readAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === COOKIE_CONSENT_ACCEPTED;
  } catch {
    return false;
  }
}
