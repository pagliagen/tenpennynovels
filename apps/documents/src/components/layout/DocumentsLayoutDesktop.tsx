'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useRef, useEffect, useCallback } from 'react';

import { useAiStatus } from '@/hooks/useAiStatus';
import { useSearchState } from '@/hooks/useSearch';
import { useAuthStore, selectCanReadMasterManual } from '@/store/authStore';
import styles from '@/styles/components/layout/DocumentsLayoutDesktop.module.scss';

import { SearchResults } from '../search/SearchResults';

import { Sidebar } from './Sidebar';

interface DocumentsLayoutDesktopProps {
  children: ReactNode;
}

interface NavTabProps {
  href: string;
  label: string;
  active: boolean;
}

/**
 * Tab della barra di navigazione.
 *
 * `<img>` e non next/image: lo sfondo è un asset decorativo a dimensione fissa
 * già in /public, e l'ottimizzazione di next/image non porta nulla qui.
 */
function NavTab({ href, label, active }: NavTabProps): JSX.Element {
  return (
    <Link href={href} className={styles.navTab}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={active ? '/images/doc_bottom_on.png' : '/images/doc_bottom_off.png'}
        alt=""
        className={styles.navTabBg}
      />
      <span className={styles.navTabLabel}>{label}</span>
    </Link>
  );
}

export function DocumentsLayoutDesktop({ children }: DocumentsLayoutDesktopProps): JSX.Element {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canReadMasterManual = useAuthStore(selectCanReadMasterManual);
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
              <NavTab
                href="/ambientazione"
                label="Ambientazione"
                active={isActiveSection('/ambientazione')}
              />
              <NavTab
                href="/regolamento"
                label="Regolamento"
                active={isActiveSection('/regolamento')}
              />
              {canReadMasterManual && (
                <NavTab
                  href="/manuale-master"
                  label="Manuale Master"
                  active={isActiveSection('/manuale-master')}
                />
              )}
              {isAuthenticated && (
                <NavTab
                  href="/preferiti"
                  label="Preferiti"
                  active={isActiveSection('/preferiti')}
                />
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
