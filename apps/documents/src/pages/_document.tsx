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
    <Html lang="it" data-scroll-behavior="smooth">
      <Head>
        {/* Favicon */}
        <link rel="icon" href="/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
