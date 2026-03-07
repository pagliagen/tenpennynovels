'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/layout/MobileBottomNav.module.scss';

export function MobileBottomNav(): JSX.Element {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isActiveSection = (path: string) => router.pathname.startsWith(path);

  return (
    <nav className={styles.nav}>
      <Link
        href="/ambientazione"
        className={`${styles.navLink} ${isActiveSection('/ambientazione') ? styles.active : ''}`}
      >
        <span className={styles.navLabel}>Ambientazione</span>
      </Link>

      <Link
        href="/regolamento"
        className={`${styles.navLink} ${isActiveSection('/regolamento') ? styles.active : ''}`}
      >
        <span className={styles.navLabel}>Regolamento</span>
      </Link>

      {isAuthenticated && (
        <Link
          href="/preferiti"
          className={`${styles.navLink} ${isActiveSection('/preferiti') ? styles.active : ''}`}
        >
          <span className={styles.navLabel}>Preferiti</span>
        </Link>
      )}
    </nav>
  );
}
