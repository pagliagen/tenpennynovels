/**
 * Editorial AI TanStack Query Hooks
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import * as editorialAPI from '@/lib/api/editorial';

export const editorialKeys = {
  all: ['admin', 'editorial'] as const,
  canonCheck: () => [...editorialKeys.all, 'canon-check'] as const,
};

/**
 * Il rapporto si rifà a richiesta (pulsante «Ricontrolla»), non in background: dopo aver corretto
 * un testo si vuole vedere il rilievo sparire, non un dato di cinque minuti fa.
 */
export function useCanonCheck() {
  return useQuery({
    queryKey: editorialKeys.canonCheck(),
    queryFn: () => editorialAPI.getCanonCheck(),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/**
 * Suggerimenti AI per una location. Sono mutazioni (una per richiesta, mai in cache): non scrivono
 * nulla sul server, restituiscono una bozza che la persona applica nel form e poi salva.
 */
export function useSuggestLocationDescription() {
  return useMutation({ mutationFn: ({ locationId, description }: { locationId: string; description: string }) => editorialAPI.suggestLocationDescription(locationId, description) });
}

export function useSuggestLocationTags() {
  return useMutation({ mutationFn: ({ locationId, description }: { locationId: string; description: string }) => editorialAPI.suggestLocationTags(locationId, description) });
}

export function useSuggestLocationPositions() {
  return useMutation({ mutationFn: (request: editorialAPI.PositionsRequest) => editorialAPI.suggestLocationPositions(request) });
}
