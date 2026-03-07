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
import React from 'react';
import dynamic from 'next/dynamic';

// Import global Victorian theme styles
import '@/styles/main.scss';

// Import Error Boundary
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
  return (
    <ErrorBoundary>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <meta name="theme-color" content="#0a1f1c" />
      </Head>
      <Component {...pageProps} />
      <CookieBanner />
    </ErrorBoundary>
  );
}
