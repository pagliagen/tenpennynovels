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

import Head from 'next/head';
import Link from 'next/link';

import styles from '@/styles/pages/NotFoundPage.module.scss';

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
      <div className={styles.root}>
      <h1 className={styles.code}>
        404
      </h1>

      <h2 className={styles.heading}>
        Page Not Found
      </h2>

      <p className={styles.quote}>
        "I fear the page you seek has vanished into the London fog, much like a certain gentleman
        of dubious repute..."
      </p>

      <Link
        href="/"
        className={styles.homeLink}
      >
        Return to Safety
      </Link>

      <p className={styles.footer}>
        Ten Penny Novels - Victorian Gothic Interactive Fiction
      </p>
    </div>
    </>
  );
}
