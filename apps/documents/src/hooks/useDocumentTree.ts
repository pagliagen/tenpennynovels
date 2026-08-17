/**
 * useDocumentTree Hook
 *
 * Fetches all documents grouped by subtype within each type.
 * Used for multi-type sidebar navigation.
 *
 * @module hooks/useDocumentTree
 * @since 2.0.0
 */

import { useQuery } from '@tanstack/react-query';

import { documentsApi } from '@/lib/api/documents';
import type { DocumentSubtype } from '@/types/document';

export interface DocumentsByType {
  ambientazione: DocumentSubtype[];
  regolamento: DocumentSubtype[];
}

/**
 * Fetch all documents grouped by subtype
 */
export function useDocumentTree() {
  return useQuery<DocumentsByType>({
    queryKey: ['documentTree'],
    queryFn: async () => {
      return await documentsApi.listHierarchical();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
