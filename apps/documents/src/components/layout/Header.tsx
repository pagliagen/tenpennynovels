'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useSearchState } from '@/hooks/useSearch';
import { SearchResults } from '../search/SearchResults';
import styles from '@/styles/components/layout/Header.module.scss';

export function Header(): JSX.Element {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, isOpen: resultsOpen, setIsOpen: setResultsOpen, results, totalResults, isLoading, aiAnswer, handleClose: handleSearchClose } =
    useSearchState();

  const isActiveSection = (path: string) => router.pathname.startsWith(path);

  const closeResults = useCallback(() => {
    handleSearchClose();
  }, [handleSearchClose]);

  useEffect(() => {
    if (!resultsOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        closeResults();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeResults();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [resultsOpen, closeResults]);

  useEffect(() => {
    closeResults();
  }, [router.asPath, closeResults]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleInputFocus = () => {
    if (query.length >= 2) {
      setResultsOpen(true);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <Link
            href="/ambientazione"
            className={`${styles.navTab} ${isActiveSection('/ambientazione') ? styles.active : ''}`}
          >
            Ambientazione
          </Link>
          <Link
            href="/regolamento"
            className={`${styles.navTab} ${isActiveSection('/regolamento') ? styles.active : ''}`}
          >
            Regolamento
          </Link>
          {isAuthenticated && (
            <Link
              href="/preferiti"
              className={`${styles.navTab} ${isActiveSection('/preferiti') ? styles.active : ''}`}
            >
              Preferiti
            </Link>
          )}
        </nav>

        <div className={styles.searchArea} ref={searchContainerRef}>
          <div className={styles.searchInputWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="ricerca per parola o frase"
              value={query}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              autoComplete="off"
              spellCheck={false}
            />

            {resultsOpen && query.length >= 2 && (
              <div className={styles.searchDropdown}>
                <SearchResults
                  results={results}
                  totalResults={totalResults}
                  query={query}
                  isLoading={isLoading}
                  aiAnswer={aiAnswer}
                  onClose={closeResults}
                />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.mobileMenuToggle}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

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
          {isAuthenticated && (
            <Link
              href="/preferiti"
              className={`${styles.mobileLink} ${isActiveSection('/preferiti') ? styles.active : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Preferiti
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
