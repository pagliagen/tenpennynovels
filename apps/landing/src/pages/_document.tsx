/**
 * Next.js Document Component
 *
 * Custom document structure for server-side rendering.
 *
 * **Features**:
 * - Set HTML language to Italian
 * - Add global meta tags for IE compatibility
 * - Wrap app with custom document structure
 *
 * @module pages/_document
 */

import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Document Component
 *
 * Next.js document component for custom HTML structure.
 *
 * @returns {JSX.Element} Document component
 */
export default function Document() {
  return (
    <Html lang="it">
      <Head>
        {/* Global meta tags - charset handled by Next.js */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
