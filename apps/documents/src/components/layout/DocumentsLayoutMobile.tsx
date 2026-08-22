'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useRef, useState, useEffect, useCallback } from 'react';

import { useSearchState } from '@/hooks/useSearch';
import { useAuthStore, selectCanReadMasterManual } from '@/store/authStore';
import styles from '@/styles/components/layout/DocumentsLayoutMobile.module.scss';

import { SearchResults } from '../search/SearchResults';

import { HamburgerMenu } from './HamburgerMenu';


interface DocumentsLayoutMobileProps {
  children: ReactNode;
}

export function DocumentsLayoutMobile({ children }: DocumentsLayoutMobileProps): JSX.Element {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canReadMasterManual = useAuthStore(selectCanReadMasterManual);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);

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
        setSearchExpanded(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeResults();
        setSearchExpanded(false);
      }
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
    setSearchExpanded(false);
  }, [router.asPath, closeResults]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleInputFocus = () => {
    if (query.length >= 2) {
      setResultsOpen(true);
    }
  };

  const toggleSearch = () => {
    setSearchExpanded((prev) => !prev);
    if (searchExpanded) {
      closeResults();
    }
  };

  return (
    <div className={styles.layout}>
      {/* Intestazione: menu, logo, ricerca */}
      <header className={styles.header}>
        <HamburgerMenu />

        <Link href="/" className={styles.logo}>
          <img
            src="/images/title.png"
            alt="Ten Penny Novels"
            width={120}
            height={50}
            className={styles.logoImage}
          />
        </Link>

        <div className={styles.searchArea} ref={searchContainerRef}>
          <button
            type="button"
            className={styles.searchToggle}
            onClick={toggleSearch}
            aria-label="Ricerca"
          >
            {searchExpanded ? '✕' : '🔍'}
          </button>

          {searchExpanded && (
            <div className={styles.searchExpandedArea}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Ricerca..."
                value={query}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                autoComplete="off"
                spellCheck={false}
                autoFocus
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
          )}
        </div>
      </header>

      {/* Menu Bar: Ambientazione | Regolamento | Manuale Master | Preferiti */}
      <nav className={styles.menuBar}>
        <Link
          href="/ambientazione"
          className={`${styles.menuTab} ${isActiveSection('/ambientazione') ? styles.active : ''}`}
        >
          Ambientazione
        </Link>
        <Link
          href="/regolamento"
          className={`${styles.menuTab} ${isActiveSection('/regolamento') ? styles.active : ''}`}
        >
          Regolamento
        </Link>
        {canReadMasterManual && (
          <Link
            href="/manuale-master"
            className={`${styles.menuTab} ${isActiveSection('/manuale-master') ? styles.active : ''}`}
          >
            Manuale Master
          </Link>
        )}
        {isAuthenticated && (
          <Link
            href="/preferiti"
            className={`${styles.menuTab} ${isActiveSection('/preferiti') ? styles.active : ''}`}
          >
            Preferiti
          </Link>
        )}
      </nav>

      {/* Content */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
