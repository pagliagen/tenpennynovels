/**
 * useDocumentDetail Hook
 *
 * Fetches single document with all sections.
 * Handles public/private access control (404 if private and not authenticated).
 *
 * @module hooks/useDocumentDetail
 * @since 1.0.0
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

import { documentsApi } from '@/lib/api/documents';
import type { DocumentDetail } from '@/types/document';

import { documentKeys } from './useDocuments';

/**
 * Fetch document detail with sections
 *
 * @param {string} type - Document type (ambientazione | regolamento)
 * @param {string} slug - Document slug
 * @param {boolean} enabled - Whether to fetch (default: true)
 * @returns {UseQueryResult<DocumentDetail>} Query result with document and sections
 *
 * @example
 * const { data, isLoading, error } = useDocumentDetail('ambientazione', 'londra-1890');
 *
 * if (error?.response?.status === 404) {
 *   // Document not found or not accessible
 * }
 */
export function useDocumentDetail(
  type: string,
  slug: string,
  enabled: boolean = true
): UseQueryResult<DocumentDetail> {
  return useQuery({
    queryKey: documentKeys.detail(type, slug),
    queryFn: () => documentsApi.get(type, slug),
    enabled: enabled && !!type && !!slug,
    staleTime: 10 * 60 * 1000, // 10 minutes (documents rarely change)
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (not found) or 403 (forbidden)
      if (error?.response?.status === 404 || error?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
