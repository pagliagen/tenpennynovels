/**
 * Custom App Component
 *
 * Initializes QueryClient for TanStack Query and applies global layout.
 * Includes auth verification via AuthInitializer.
 *
 * @module pages/_app
 * @since 1.0.0
 */

import { QueryClientProvider } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import localFont from 'next/font/local';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useReportWebVitals } from 'next/web-vitals';
import { useEffect } from 'react';

import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { queryClient } from '@/lib/api/queryClient';
import { getCharacterSessionId } from '@/lib/characterSession';
import { readAnalyticsConsent } from '@/lib/cookieConsent';
import { logger } from '@/lib/logger';

// Victorian fonts optimization with next/font
const thriftedAttire = localFont({
  src: [
    {
      path: '../../public/fonts/thrifted-attire-regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/thrifted-attire-italic.otf',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-thrifted',
  display: 'swap',
  preload: true,
});

const lesMysteres = localFont({
  src: '../../public/fonts/les-mysteres-de-paris.ttf',
  variable: '--font-mysteres',
  display: 'swap',
  preload: true,
});

const bahnschrift = localFont({
  src: '../../public/fonts/bahnschrift.ttf',
  variable: '--font-bahnschrift',
  display: 'swap',
  preload: true,
});

/** Devtools caricati solo sul client e solo in dev (pacchetto in devDependencies, assente in prod) */
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamic(
      () => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
      { ssr: false }
    )
  : () => null;
import { DocumentsLayout } from '@/components/layout/DocumentsLayout';
import '@/styles/globals.scss';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  // Preview live per l'iframe del gestionale: niente nav/sidebar del sito.
  const isEmbedPreview = router.pathname.startsWith('/preview');

  /**
   * Ripulisce l'URL dal `?sessionId=` dopo il redirect dal gioco.
   *
   * La PERSISTENZA non è più qui: la fa getCharacterSessionId() leggendo
   * direttamente dall'URL alla prima richiesta. Questo effect girava dopo
   * quello di useAuth (React esegue gli effect dei figli prima del padre) e
   * dopo l'idratazione di router.query, quindi la prima chiamata a
   * /auth/session partiva senza X-Session-Id e senza gamePermissions — vedi
   * lib/characterSession.ts.
   */
  useEffect(() => {
    const { sessionId } = router.query;

    if (sessionId && typeof sessionId === 'string') {
      // Persistenza idempotente, nel caso nessuna richiesta sia ancora partita.
      getCharacterSessionId();

      // asPath e non pathname: su una rotta dinamica pathname è il template
      // ('/ambientazione/[...slug]'), quindi la replace non ripuliva nulla e il
      // sessionId restava nell'URL — finendo in cronologia e in qualunque link
      // copiato. Si notava solo ora: prima l'unica pagina che riceveva il
      // parametro era la root, dove pathname e asPath coincidono.
      const pathWithoutQuery = router.asPath.split('?')[0] ?? router.asPath;
      void router.replace(pathWithoutQuery, undefined, { shallow: true });
    }
  }, [router, router.query.sessionId]);

  // Report Web Vitals to Google Analytics
  useReportWebVitals((metric) => {
    if (GA_ID && typeof window !== 'undefined' && readAnalyticsConsent() && window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }

    logger.debug('[Indicatori web]', { metric });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Google Analytics 4 */}
      {GA_ID && process.env.NODE_ENV === 'production' && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
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
      )}

      <div className={`${thriftedAttire.variable} ${lesMysteres.variable} ${bahnschrift.variable}`}>
        <AuthInitializer>
          {isEmbedPreview ? (
            <Component {...pageProps} />
          ) : (
            <DocumentsLayout>
              <Component {...pageProps} />
            </DocumentsLayout>
          )}

          {/* React Query Devtools (dynamic import, solo in dev; in prod è no-op) */}
          <ReactQueryDevtools initialIsOpen={false} />
        </AuthInitializer>
      </div>
    </QueryClientProvider>
  );
}
