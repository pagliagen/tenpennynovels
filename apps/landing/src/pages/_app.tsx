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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <meta name="theme-color" content="#050505" />
      </Head>
      <Component {...pageProps} />
      <CookieBanner />

      {/* SEO Info Footer - Subtle and non-intrusive */}
      <footer style={{
        margin: '2rem auto 0',
        padding: '1rem 0',
        fontSize: '0.875rem',
        color: '#a89884',
        textAlign: 'center',
        borderTop: '1px solid rgba(6, 115, 104, 0.2)'
      }}>
        <h2 style={{
          fontSize: '1.125rem',
          marginBottom: '0.5rem',
          color: '#8b7355',
          fontWeight: 'normal',
          fontFamily: 'IM Fell English, serif'
        }}>
          Gioco di Ruolo Londra Vittoriana
        </h2>

        <p style={{
          fontSize: '0.875rem',
          lineHeight: '1.5',
          marginBottom: '0.5rem',
          color: '#a89884'
        }}>
          <strong>TenpennyNovels</strong> è un gioco di ruolo online gratuito ambientato nella suggestiva{' '}
          <strong>Londra Vittoriana degli anni 1890</strong>. Basato sul celebre sistema{' '}
          <strong>Call of Cthulhu</strong>, offre un'esperienza GDR investigativa unica via chat.
        </p>

        <p style={{
          fontSize: '0.8125rem',
          lineHeight: '1.5',
          color: '#a89884'
        }}>
          Crea il tuo personaggio vittoriano, esplora le nebbiose strade di Londra,
          interagisci con altri giocatori e vivi avventure horror lovecraftiane.{' '}
          <strong>Registrazione gratuita</strong> e immediata!
        </p>
      </footer>
    </ErrorBoundary>
  );
}
