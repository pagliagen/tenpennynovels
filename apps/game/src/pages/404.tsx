/**
 * 404 Error Page
 *
 * Custom error page shown when user navigates to non-existent route.
 *
 * Features:
 * - Victorian-themed error message
 * - Link back to home page
 * - Styled to match app theme
 *
 * @module pages/404
 * @since 2.0.0
 */

import Link from 'next/link';
import Head from 'next/head';

/**
 * 404 Error Page Component
 *
 * Shows Victorian-styled "page not found" message.
 *
 * @component
 * @returns {JSX.Element} 404 error page content
 * @since 2.0.0
 *
 * @example
 * // Automatically rendered by Next.js when route not found
 * // No need to import or use directly
 */
export default function Custom404(): JSX.Element {
  return (
    <>
      <Head>
        <title>Ten Penny Novels | Pagina Non Trovata</title>
        <meta name="description" content="La pagina che cerchi è svanita nella nebbia londinese. Torna alla tua avventura su Ten Penny Novels." />
      </Head>
      <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'Merriweather, serif',
        backgroundColor: '#f5f5f5',
      }}
    >
      <h1
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '6rem',
          marginBottom: '0',
          color: '#8B4513',
        }}
      >
        404
      </h1>

      <h2
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '2rem',
          marginBottom: '1rem',
          color: '#333',
        }}
      >
        Page Not Found
      </h2>

      <p
        style={{
          fontSize: '1.1rem',
          marginBottom: '2rem',
          color: '#666',
          textAlign: 'center',
          maxWidth: '500px',
          fontStyle: 'italic',
        }}
      >
        "I fear the page you seek has vanished into the London fog, much like a certain gentleman
        of dubious repute..."
      </p>

      <Link
        href="/"
        style={{
          padding: '0.75rem 2rem',
          backgroundColor: '#8B4513',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          transition: 'background-color 0.2s',
        }}
      >
        Return to Safety
      </Link>

      <p
        style={{
          marginTop: '3rem',
          fontSize: '0.85rem',
          color: '#999',
        }}
      >
        Ten Penny Novels - Victorian Gothic Interactive Fiction
      </p>
    </div>
    </>
  );
}
