/**
 * Cookie / analytics consent storage (GDPR-oriented).
 * Kept in sync with apps/landing/src/lib/cookieConsent.ts.
 */
export const COOKIE_CONSENT_STORAGE_KEY = 'tpn_cookie_consent';

export const COOKIE_CONSENT_ACCEPTED = 'accepted';

export const COOKIE_CONSENT_EVENT = 'tpn-cookie-consent-accepted';

export function readAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === COOKIE_CONSENT_ACCEPTED;
  } catch {
    return false;
  }
}
