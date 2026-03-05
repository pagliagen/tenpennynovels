/**
 * SearchBar Component
 *
 * Semantic search input with real-time results.
 * Powered by Qdrant vector database.
 *
 * @module components/search/SearchBar
 * @since 1.0.0
 */

'use client';

import { useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSearchState } from '@/hooks/useSearch';
import { SearchResults } from './SearchResults';
import styles from '@/styles/components/SearchBar.module.scss';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({ placeholder = 'Cerca nei documenti...', className, autoFocus }: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, isOpen, setIsOpen, results, totalResults, isLoading, handleClose } =
    useSearchState();

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClose]);

  // Close on route change
  useEffect(() => {
    handleClose();
  }, [router.asPath, handleClose]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Cmd+K or Ctrl+K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }

      // Escape to close
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        handleClose();
        inputRef.current?.blur();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen, handleClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
  };

  const handleFocus = () => {
    if (query.length >= 2) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={`${styles.searchContainer} ${className || ''}`}>
      <div className={styles.searchInputWrapper}>
        <svg
          className={styles.searchIcon}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16ZM19 19l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          autoComplete="off"
          spellCheck="false"
        />

        {query && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClose}
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        <kbd className={styles.shortcut}>⌘K</kbd>
      </div>

      {isOpen && query.length >= 2 && (
        <SearchResults
          results={results}
          totalResults={totalResults}
          query={query}
          isLoading={isLoading}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
