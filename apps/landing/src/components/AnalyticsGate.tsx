/**
 * Loads Google Analytics only after cookie consent (see CookieBanner).
 */
import React, { useEffect, useState } from 'react';
import Script from 'next/script';
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_ACCEPTED,
} from '@/lib/cookieConsent';

export const AnalyticsGate: React.FC = () => {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        setConsented(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === COOKIE_CONSENT_ACCEPTED);
      } catch {
        setConsented(false);
      }
    };

    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, []);

  if (!GA_ID || process.env.NODE_ENV !== 'production' || !consented) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
};
