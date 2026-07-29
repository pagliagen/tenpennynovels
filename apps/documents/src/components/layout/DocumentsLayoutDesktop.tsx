'use client';

import { ReactNode, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useSearchState } from '@/hooks/useSearch';
import { useAiStatus } from '@/hooks/useAiStatus';
import { Sidebar } from './Sidebar';
import { SearchResults } from '../search/SearchResults';
import styles from '@/styles/components/layout/DocumentsLayoutDesktop.module.scss';

interface DocumentsLayoutDesktopProps {
  children: ReactNode;
}

export function DocumentsLayoutDesktop({ children }: DocumentsLayoutDesktopProps): JSX.Element {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { aiAvailable } = useAiStatus();

  const {
    query, setQuery,
    isOpen: resultsOpen, setIsOpen: setResultsOpen,
    results, totalResults, isLoading, aiAnswer,
    aiEnrichments, aiReading, aiLoading, aiComplete,
    handleClose: handleSearchClose,
  } = useSearchState();

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
    <div className={styles.layout}>
      <Sidebar />

      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <nav className={styles.nav}>
              <Link href="/ambientazione" className={styles.navTab}>
                <img
                  src={isActiveSection('/ambientazione') ? '/images/doc_bottom_on.png' : '/images/doc_bottom_off.png'}
                  alt=""
                  className={styles.navTabBg}
                />
                <span className={styles.navTabLabel}>Ambientazione</span>
              </Link>
              <Link href="/regolamento" className={styles.navTab}>
                <img
                  src={isActiveSection('/regolamento') ? '/images/doc_bottom_on.png' : '/images/doc_bottom_off.png'}
                  alt=""
                  className={styles.navTabBg}
                />
                <span className={styles.navTabLabel}>Regolamento</span>
              </Link>
              {isAuthenticated && (
                <Link href="/preferiti" className={styles.navTab}>
                  <img
                    src={isActiveSection('/preferiti') ? '/images/doc_bottom_on.png' : '/images/doc_bottom_off.png'}
                    alt=""
                    className={styles.navTabBg}
                  />
                  <span className={styles.navTabLabel}>Preferiti</span>
                </Link>
              )}
            </nav>

            <div className={styles.searchArea} ref={searchContainerRef}>
              <div className={styles.searchInputWrapper}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder={aiAvailable ? 'Cerca per parola chiave oppure fai una domanda...' : 'Cerca per parola chiave'}
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
                      aiEnrichments={aiEnrichments}
                      aiReading={aiReading}
                      aiLoading={aiLoading}
                      aiComplete={aiComplete}
                      onClose={closeResults}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}
