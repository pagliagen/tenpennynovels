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
        {/* Viewport for proper DPI scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />

        {/* Favicon */}
        <link rel="icon" href="/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />

        {/* Meta Tags */}
        <meta name="theme-color" content="#091918" />
        <meta name="description" content="Ten Penny Novels - Archivi di Ambientazione e Regolamento" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
