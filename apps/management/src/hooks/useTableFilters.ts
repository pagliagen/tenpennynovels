/**
 * useTableFilters - Custom Hook for Table Filter Management
 *
 * Centralizza la logica di gestione filtri duplicata in 5 pagine list.
 * Fornisce state management unificato per filters e params con handler standard.
 *
 * @template T - Tipo dei parametri della tabella (es. UserListParams, CharacterListParams)
 */

import { useState, useCallback } from 'react';
import type { FilterState } from '@/components/shared/ConfigurableDataTable';

/**
 * Hook per gestire filters e params di tabelle paginate
 *
 * @param initialParams - Parametri iniziali (page, pageSize, sortBy, sortOrder)
 * @returns Oggetto con filters, params, setters e handler
 *
 * @example
 * ```tsx
 * const { filters, params, setParams, handleFilterChange } = useTableFilters({
 *   page: 1,
 *   pageSize: 25,
 *   sortBy: 'createdAt',
 *   sortOrder: 'desc'
 * });
 * ```
 */
export function useTableFilters<T extends Record<string, unknown>>(initialParams: T) {
  const [filters, setFilters] = useState<FilterState>({});
  const [params, setParams] = useState<T>(initialParams);

  /**
   * Handler per cambio filtri
   * Aggiorna sia filters che params, resettando sempre a page 1
   */
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setParams(prev => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  return {
    filters,
    params,
    setParams,
    handleFilterChange
  };
}
