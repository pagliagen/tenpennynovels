/**
 * useURLFilter Hook
 *
 * React hook for reading and syncing URL hash filters with component state.
 * Automatically updates when URL hash changes (e.g., browser back/forward).
 *
 * @module hooks/useURLFilter
 */

import { useState, useEffect } from 'react';
import { readFilterFromHash, FilterParams } from '@/lib/utils/urlFilters';

/**
 * Hook for reading URL filter and syncing with state
 *
 * Reads filter from URL hash on mount and subscribes to hash changes.
 * Returns decoded filter object or null if no filter present.
 *
 * @template T - Filter params type (extends FilterParams)
 * @returns Decoded filter object from URL hash, or null
 *
 * @example
 * ```tsx
 * // In character-list.tsx
 * const urlFilter = useURLFilter<{ userId?: string; status?: string }>();
 *
 * const params = {
 *   page: 1,
 *   pageSize: 50,
 *   ...(urlFilter?.userId && { userId: urlFilter.userId }),
 *   ...(urlFilter?.status && { status: urlFilter.status })
 * };
 *
 * const { data } = useCharacters(params);
 * ```
 *
 * @example
 * ```tsx
 * // Show filter badge when active
 * {urlFilter && (
 *   <div className={styles.filterBadge}>
 *     Filtri attivi: {Object.keys(urlFilter).join(', ')}
 *     <button onClick={() => {
 *       clearFilterHash();
 *       router.reload();
 *     }}>
 *       ✕ Rimuovi
 *     </button>
 *   </div>
 * )}
 * ```
 */
export function useURLFilter<T extends FilterParams = FilterParams>(): T | null {
  const [filter, setFilter] = useState<T | null>(null);

  useEffect(() => {
    // Read filter on mount
    const initialFilter = readFilterFromHash() as T | null;
    setFilter(initialFilter);

    // Listen for hash changes (browser back/forward)
    const handleHashChange = () => {
      const newFilter = readFilterFromHash() as T | null;
      setFilter(newFilter);
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return filter;
}
