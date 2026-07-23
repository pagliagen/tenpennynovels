/**
 * useForumCategories Hooks
 *
 * TanStack Query hooks for forum category (macrocategoria) operations.
 *
 * **Hooks**:
 * - useForumCategories() - List all visible categories
 *
 * @module hooks/useForumCategories
 * @since 2.1.0
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { forumApi } from '@/lib/api/forum';
import type { ForumCategory } from '@/types/forum';

export const forumCategoryKeys = {
  all: ['forum', 'categories'] as const,
  list: () => [...forumCategoryKeys.all, 'list'] as const,
};

/**
 * useForumCategories Hook
 *
 * Fetches all visible forum categories, sorted by sortOrder.
 *
 * @returns {UseQueryResult<ForumCategory[]>} Query result with categories array
 */
export function useForumCategories(): UseQueryResult<ForumCategory[], Error> {
  return useQuery({
    queryKey: forumCategoryKeys.list(),
    queryFn: () => forumApi.getCategories(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
