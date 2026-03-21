/**
 * Next.js App Component
 *
 * Global app wrapper for all pages.
 *
 * **Features**:
 * - Import global SCSS styles
 * - Add global meta tags (viewport, favicon)
 * - Add CookieBanner (SSR-disabled)
 * - Wrap all pages with common layout
 *
 * @module pages/_app
 */

import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import React from 'react';
import dynamic from 'next/dynamic';
import { useReportWebVitals } from 'next/web-vitals';
import localFont from 'next/font/local';

// Import global Victorian theme styles
import '@/styles/main.scss';

// Import Error Boundary
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

// Dynamic import of CookieBanner to avoid SSR issues
const CookieBanner = dynamic(() => import('@/components/CookieBanner').then(mod => ({ default: mod.CookieBanner })), {
  ssr: false,
});

/**
 * App Component
 *
 * Next.js root app component that wraps all pages.
 *
 * @param {AppProps} props - Next.js app props
 * @returns {JSX.Element} App component
 */
export default function App({ Component, pageProps }: AppProps) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

  // Report Web Vitals to Google Analytics
  useReportWebVitals((metric) => {
    if (GA_ID && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals]', metric);
    }
  });

  return (
    <ErrorBoundary>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <meta name="theme-color" content="#0a1f1c" />
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

      <div className={`${thriftedAttire.variable} ${lesMysteres.variable}`}>
        <Component {...pageProps} />
        <CookieBanner />
      </div>
    </ErrorBoundary>
  );
}
