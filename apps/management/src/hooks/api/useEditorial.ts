/**
 * Editorial AI TanStack Query Hooks
 */

import { useQuery } from '@tanstack/react-query';
import * as editorialAPI from '@/lib/api/editorial';

export const editorialKeys = {
  all: ['admin', 'editorial'] as const,
  canonCheck: () => [...editorialKeys.all, 'canon-check'] as const,
};

/**
 * Il rapporto si rifà a richiesta (pulsante «Ricontrolla»), non in background: dopo aver corretto
 * un testo si vuole vedere il rilievo sparire, non un dato di cinque minuti fa.
 */
export function useCanonCheck(enabled: boolean) {
  return useQuery({
    queryKey: editorialKeys.canonCheck(),
    queryFn: () => editorialAPI.getCanonCheck(),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
