/**
 * Custom App Component
 *
 * Initializes QueryClient for TanStack Query and applies global layout.
 * Includes auth verification via AuthInitializer.
 *
 * @module pages/_app
 * @since 1.0.0
 */

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useReportWebVitals } from 'next/web-vitals';
import localFont from 'next/font/local';
import { queryClient } from '@/lib/api/queryClient';

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
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { DocumentsLayout } from '@/components/layout/DocumentsLayout';
import '@/styles/globals.scss';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

  /**
   * Initialize sessionId from query parameter
   *
   * When redirecting from game app (different origin), sessionStorage is NOT shared.
   * Game app passes sessionId as query param: ?sessionId=xxx
   * This effect reads it and saves to sessionStorage (once).
   */
  useEffect(() => {
    const { sessionId } = router.query;

    if (sessionId && typeof sessionId === 'string') {
      try {
        sessionStorage.setItem('character_session_id', sessionId);

        // Clean URL (remove query param)
        router.replace(router.pathname, undefined, { shallow: true });
      } catch (error) {
        console.error('[App documenti] Impossibile salvare sessionId:', error);
      }
    }
  }, [router.query.sessionId]);

  // Report Web Vitals to Google Analytics
  useReportWebVitals((metric) => {
    if (GA_ID && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Indicatori web]', metric);
    }
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
          <DocumentsLayout>
            <Component {...pageProps} />
          </DocumentsLayout>

          {/* React Query Devtools (dynamic import, solo in dev; in prod è no-op) */}
          <ReactQueryDevtools initialIsOpen={false} />
        </AuthInitializer>
      </div>
    </QueryClientProvider>
  );
}
