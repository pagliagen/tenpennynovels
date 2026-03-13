/**
 * useForumTopics Hooks
 *
 * TanStack Query hooks for forum topic operations.
 * Handles server state with automatic caching, loading states, and error handling.
 *
 * **Hooks**:
 * - useForumTopics() - List all accessible topics
 * - useForumTopic(slug) - Get single topic by slug
 * - useToggleFavorite() - Toggle topic favorite
 *
 * @module hooks/useForumTopics
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { forumApi } from '@/lib/api/forum';
import type { ForumTopic } from '@/types/forum';

/**
 * Query Keys
 *
 * Centralized query keys for cache invalidation.
 */
export const forumTopicKeys = {
  all: ['forum', 'topics'] as const,
  list: () => [...forumTopicKeys.all, 'list'] as const,
  detail: (slug: string) => [...forumTopicKeys.all, 'detail', slug] as const,
  favorites: () => [...forumTopicKeys.all, 'favorites'] as const,
};

/**
 * useForumTopics Hook
 *
 * Fetches all forum topics accessible to the current character.
 *
 * @returns {UseQueryResult<ForumTopic[]>} Query result with topics array
 */
export function useForumTopics(): UseQueryResult<ForumTopic[], Error> {
  return useQuery({
    queryKey: forumTopicKeys.list(),
    queryFn: () => forumApi.getTopics(),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useForumTopic Hook
 *
 * Fetches a single topic by slug.
 * Disabled when slug is null/undefined.
 *
 * @param {string | null} slug - Topic slug
 * @returns {UseQueryResult<ForumTopic>} Query result
 */
export function useForumTopic(slug: string | null): UseQueryResult<ForumTopic, Error> {
  return useQuery({
    queryKey: forumTopicKeys.detail(slug!),
    queryFn: () => forumApi.getTopic(slug!),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useToggleFavorite Hook
 *
 * Toggles favorite status on a topic.
 * Invalidates topics list and favorites cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useToggleFavorite(): UseMutationResult<
  { isFavorite: boolean },
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (topicSlug: string) => forumApi.toggleFavorite(topicSlug),
    onSuccess: (_, topicSlug) => {
      queryClient.invalidateQueries({ queryKey: forumTopicKeys.list() });
      queryClient.invalidateQueries({ queryKey: forumTopicKeys.favorites() });
      queryClient.invalidateQueries({ queryKey: forumTopicKeys.detail(topicSlug) });
    },
  });
}
