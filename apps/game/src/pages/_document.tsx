/**
 * Custom Document Component
 *
 * Customizes the HTML document structure for the entire application.
 * ONLY renders server-side during SSR - NO client-side code allowed here.
 *
 * Purpose:
 * - Apply theme attribute to <html> tag (prevents FOUC)
 * - Inject global meta tags (charset, viewport, IE compatibility)
 * - Preconnect to Google Fonts for performance
 * - Set language attribute for accessibility
 *
 * CRITICAL: This file CANNOT use React hooks or access browser APIs.
 * All logic here is static and runs only on server.
 *
 * @module pages/_document
 * @since 2.0.0
 */

import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Custom Document Component
 *
 * Extends Next.js default document to add:
 * - Victorian theme attribute on <html> tag
 * - Global meta tags for charset and viewport
 * - Google Fonts preconnect for performance
 * - Italian language attribute
 *
 * @component
 * @returns {JSX.Element} HTML document structure
 * @since 2.0.0
 *
 * @example
 * // This component is automatically used by Next.js
 * // No need to import or use directly
 */
export default function Document(): JSX.Element {
  return (
    <Html lang="it" data-theme="victorian">
      <Head>
        {/* Character Encoding */}
        <meta charSet="utf-8" />

        {/* IE Compatibility Mode */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Preconnect to Google Fonts for Performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Google Fonts: Playfair Display (Victorian Headings) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />

        {/* Google Fonts: Merriweather (Victorian Body Text) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />

        {/* Manifest for PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme Color for Mobile Browsers */}
        <meta name="theme-color" content="#8B4513" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
