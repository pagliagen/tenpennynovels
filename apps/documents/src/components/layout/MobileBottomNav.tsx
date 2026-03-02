/**
 * MobileBottomNav Component
 *
 * Mobile bottom navigation bar for section switching.
 * Fixed at bottom of screen on mobile devices.
 *
 * @module components/layout/MobileBottomNav
 * @since 1.0.0
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/components/layout/MobileBottomNav.module.scss';

export function MobileBottomNav(): JSX.Element {
  const router = useRouter();

  const isActiveSection = (path: string) => {
    // Approfondimenti is part of Ambientazione section
    if (path === '/ambientazione' && router.pathname.startsWith('/approfondimenti')) {
      return true;
    }
    return router.pathname.startsWith(path);
  };

  return (
    <nav className={styles.nav}>
      <Link
        href="/ambientazione"
        className={`${styles.navLink} ${isActiveSection('/ambientazione') ? styles.active : ''}`}
      >
        <span className={styles.navIcon}>🌍</span>
        <span className={styles.navLabel}>Ambientazione</span>
      </Link>

      <Link
        href="/regolamento"
        className={`${styles.navLink} ${isActiveSection('/regolamento') ? styles.active : ''}`}
      >
        <span className={styles.navIcon}>📜</span>
        <span className={styles.navLabel}>Regolamento</span>
      </Link>
    </nav>
  );
}
