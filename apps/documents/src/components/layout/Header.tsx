/**
 * Header Component
 *
 * Victorian-themed header with logo, section tabs, and search toggle.
 * Desktop: Full navigation. Mobile: Simplified with hamburger menu.
 *
 * @module components/layout/Header
 * @since 1.0.0
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { SearchBar } from '../search/SearchBar';
import styles from '@/styles/components/layout/Header.module.scss';

interface HeaderProps {
  onSearchToggle?: () => void;
  showSearch?: boolean;
}

export function Header({ onSearchToggle, showSearch }: HeaderProps): JSX.Element {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActiveSection = (path: string) => {
    // Approfondimenti is part of Ambientazione section
    if (path === '/ambientazione' && router.pathname.startsWith('/approfondimenti')) {
      return true;
    }
    return router.pathname.startsWith(path);
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>📚</span>
          <span className={styles.logoText}>
            <span className={styles.logoMain}>TenpennyNovels</span>
            <span className={styles.logoSub}>Archivi</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.nav}>
          <Link
            href="/ambientazione"
            className={`${styles.navLink} ${isActiveSection('/ambientazione') ? styles.active : ''}`}
          >
            Ambientazione
          </Link>
          <Link
            href="/regolamento"
            className={`${styles.navLink} ${isActiveSection('/regolamento') ? styles.active : ''}`}
          >
            Regolamento
          </Link>
        </nav>

        {/* Search Bar (inline) or Search Toggle */}
        {showSearch ? (
          <div className={styles.searchBarWrapper}>
            <SearchBar placeholder="Cerca documenti..." className={styles.inlineSearch} />
            <button
              type="button"
              className={styles.closeSearch}
              onClick={onSearchToggle}
              aria-label="Close search"
            >
              ✕
            </button>
          </div>
        ) : (
          onSearchToggle && (
            <button
              type="button"
              className={styles.searchToggle}
              onClick={onSearchToggle}
              aria-label="Toggle search"
            >
              🔍
            </button>
          )
        )}

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          className={styles.mobileMenuToggle}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <Link
            href="/ambientazione"
            className={`${styles.mobileLink} ${isActiveSection('/ambientazione') ? styles.active : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Ambientazione
          </Link>
          <Link
            href="/regolamento"
            className={`${styles.mobileLink} ${isActiveSection('/regolamento') ? styles.active : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Regolamento
          </Link>
        </div>
      )}
    </header>
  );
}
