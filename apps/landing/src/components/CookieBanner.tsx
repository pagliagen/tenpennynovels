/**
 * Cookie Banner Component
 *
 * Displays a cookie consent banner for GDPR/privacy compliance.
 * Only shows if user hasn't previously accepted. Persists consent in localStorage.
 *
 * **Features**:
 * - SSR safe (only renders client-side)
 * - localStorage persistence
 * - Link to Privacy Policy
 * - Dismissible
 * - Victorian styling
 *
 * **Cookie Usage**:
 * - Cookie essenziali per autenticazione e sessione di gioco.
 * - Con consenso: Google Analytics (solo se `NEXT_PUBLIC_GA_ID` è configurato in build).
 *
 * @module components/CookieBanner
 */

import React, { useState, useEffect } from 'react';
import { ClientOnly } from './ClientOnly';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_ACCEPTED,
  COOKIE_CONSENT_EVENT,
} from '@/lib/cookieConsent';
import { logger } from '@/lib/logger';

const hasAnalyticsInBuild = Boolean(process.env.NEXT_PUBLIC_GA_ID);

/**
 * Cookie Banner Content Component
 *
 * Internal component that handles the actual banner logic.
 * Wrapped in ClientOnly to prevent SSR issues with localStorage.
 *
 * @returns {JSX.Element | null} Banner or null if consent given
 */
const CookieBannerContent: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  /**
   * Check localStorage for existing consent on mount
   *
   * If user has previously accepted, don't show banner.
   * If localStorage is unavailable, don't show banner (fail gracefully).
   */
  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!consent) {
        setIsVisible(true);
      }
    } catch (error) {
      // localStorage unavailable (private mode, disabled, etc.)
      // Don't show banner to avoid annoying users
      logger.warn('[CookieBanner] localStorage unavailable', { error });
    }
  }, []);

  /**
   * Handles user acceptance of cookies
   *
   * Saves consent to localStorage and hides banner.
   * If localStorage save fails, still hide banner (better UX).
   */
  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_ACCEPTED);
    } catch (error) {
      logger.warn('[CookieBanner] Failed to save consent', { error });
    }

    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
    setIsVisible(false);
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div className="cookie-banner">
      <div className="cookie-banner__background"></div>
      <div className="cookie-banner__content">
        {/* Banner text */}
        <div className="cookie-banner__text">
          <h4 className="cookie-banner__title">🍪 Cookie & Privacy</h4>
          <p className="cookie-banner__description">
            Questo sito utilizza <strong>cookie essenziali</strong> per l&apos;autenticazione e le
            sessioni di gioco.
            {hasAnalyticsInBuild ? (
              <>
                {' '}
                Se clicchi &quot;Accetto&quot;, attiviamo anche <strong>Google Analytics</strong> in
                forma aggregata per capire come viene usato il sito (nessuna pubblicità).
              </>
            ) : (
              <> Non utilizziamo cookie pubblicitari.</>
            )}
          </p>
        </div>

        {/* Banner actions */}
        <div className="cookie-banner__actions">
          <button
            type="button"
            className="cookie-banner__accept"
            onClick={handleAccept}
          >
            Accetto
          </button>

          <span className="cookie-banner__privacy-link">
            Consulta la Privacy Policy nella pagina di registrazione
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Cookie Banner Component
 *
 * Renders a GDPR-compliant cookie consent banner.
 * Only shows if user hasn't previously accepted cookies.
 *
 * **Benefits**:
 * - **SSR Safe**: Uses ClientOnly wrapper
 * - **Persistent**: Remembers user choice via localStorage
 * - **Graceful Degradation**: Works even if localStorage unavailable
 * - **Accessibility**: Semantic HTML, keyboard navigation
 *
 * **Implementation Note**:
 * This component should be placed in the main layout (_app.tsx)
 * so it appears on all pages.
 *
 * @returns {JSX.Element} Cookie banner (wrapped in ClientOnly)
 *
 * @example
 * ```typescript
 * import { CookieBanner } from '@/components/CookieBanner';
 *
 * function MyApp({ Component, pageProps }: AppProps) {
 *   return (
 *     <>
 *       <Component {...pageProps} />
 *       <CookieBanner />
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In layout component
 * function Layout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <div>
 *       {children}
 *       <CookieBanner />
 *     </div>
 *   );
 * }
 * ```
 */
export const CookieBanner: React.FC = () => {
  return (
    <ClientOnly>
      <CookieBannerContent />
    </ClientOnly>
  );
};
