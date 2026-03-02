/**
 * useDocuments Hook
 *
 * Fetches and manages document list with caching.
 * Backend automatically filters by auth status (public only if not authenticated).
 *
 * @module hooks/useDocuments
 * @since 1.0.0
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/documents';
import type { Document, DocumentType } from '@/types/document';

/**
 * Query keys factory for documents
 */
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (type?: DocumentType) => [...documentKeys.lists(), type] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (type: string, slug: string) => [...documentKeys.details(), type, slug] as const,
};

/**
 * Fetch documents with automatic auth-based filtering
 *
 * @param {DocumentType} type - Optional type filter (ambientazione | regolamento)
 * @returns {UseQueryResult<Document[]>} Query result with documents list
 *
 * @example
 * const { data: documents, isLoading, error } = useDocuments('ambientazione');
 */
export function useDocuments(type?: DocumentType): UseQueryResult<Document[]> {
  return useQuery({
    queryKey: documentKeys.list(type),
    queryFn: () => documentsApi.list({ type }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}
