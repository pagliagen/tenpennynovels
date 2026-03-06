/**
 * Custom Document Component
 *
 * Customizes HTML document structure with Victorian fonts and metadata.
 *
 * @module pages/_document
 * @since 1.0.0
 */

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="it">
      <Head>
        {/* Victorian Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barrio&display=swap"
          rel="stylesheet"
        />

        {/* Favicon */}
        <link rel="icon" href="/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />

        {/* Meta Tags */}
        <meta name="theme-color" content="#f4f1e8" />
        <meta name="description" content="TenPennyNovels - Archivi di Ambientazione e Regolamento" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
