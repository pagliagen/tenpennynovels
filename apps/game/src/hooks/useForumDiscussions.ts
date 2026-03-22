/**
 * useForumDiscussions Hooks
 *
 * TanStack Query hooks for forum discussion operations.
 * Handles server state with automatic caching, loading states, and error handling.
 *
 * **Hooks**:
 * - useForumDiscussions(topicSlug, page) - List discussions in a topic
 * - useForumDiscussion(topicSlug, discussionSlug) - Get single discussion
 * - useCreateDiscussion() - Create new discussion
 * - useUpdateDiscussion() - Update discussion
 * - useDeleteDiscussion() - Delete discussion
 * - useToggleSubscription() - Toggle discussion subscription
 * - useRecentDiscussions(limit) - Get recent discussions
 * - usePopularDiscussions(timeframe, limit) - Get popular discussions
 *
 * @module hooks/useForumDiscussions
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

import { forumApi } from '@/lib/api/forum';
import type { ForumDiscussion, PaginationInfo } from '@/types/forum';

/**
 * Query Keys
 *
 * Centralized query keys for cache invalidation.
 */
export const forumDiscussionKeys = {
  all: ['forum', 'discussions'] as const,
  list: (topicSlug: string) => [...forumDiscussionKeys.all, 'list', topicSlug] as const,
  detail: (topicSlug: string, discussionSlug: string) =>
    [...forumDiscussionKeys.all, 'detail', topicSlug, discussionSlug] as const,
  recent: () => [...forumDiscussionKeys.all, 'recent'] as const,
  popular: (timeframe?: string) => [...forumDiscussionKeys.all, 'popular', timeframe] as const,
};

/**
 * useForumDiscussions Hook
 *
 * Fetches paginated discussions for a topic.
 * Disabled when topicSlug is null.
 *
 * @param {string | null} topicSlug - Topic slug
 * @param {number} [page] - Page number (1-based)
 * @returns {UseQueryResult} Query result with items and pagination
 */
export function useForumDiscussions(
  topicSlug: string | null,
  page?: number
): UseQueryResult<{ list: ForumDiscussion[]; pagination: PaginationInfo }, Error> {
  return useQuery({
    queryKey: [...forumDiscussionKeys.list(topicSlug!), page] as const,
    queryFn: () => forumApi.getDiscussions(topicSlug!, page),
    enabled: !!topicSlug,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useForumDiscussion Hook
 *
 * Fetches a single discussion by slugs.
 * Disabled when either slug is null.
 *
 * @param {string | null} topicSlug - Topic slug
 * @param {string | null} discussionSlug - Discussion slug
 * @returns {UseQueryResult<ForumDiscussion>} Query result
 */
export function useForumDiscussion(
  topicSlug: string | null,
  discussionSlug: string | null
): UseQueryResult<ForumDiscussion, Error> {
  return useQuery({
    queryKey: forumDiscussionKeys.detail(topicSlug!, discussionSlug!),
    queryFn: () => forumApi.getDiscussion(topicSlug!, discussionSlug!),
    enabled: !!topicSlug && !!discussionSlug,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useCreateDiscussion Hook
 *
 * Creates a new discussion in a topic.
 * Invalidates discussion list cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useCreateDiscussion(): UseMutationResult<
  { id: string; slug: string },
  Error,
  { topicSlug: string; data: { title: string; content: string; tags?: string[] } }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicSlug, data }) => forumApi.createDiscussion(topicSlug, data),
    onSuccess: (_, { topicSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.list(topicSlug) });
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.recent() });
    },
  });
}

/**
 * useUpdateDiscussion Hook
 *
 * Updates an existing discussion.
 * Invalidates discussion detail and list cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useUpdateDiscussion(): UseMutationResult<
  void,
  Error,
  { topicSlug: string; discussionSlug: string; data: { title?: string; tags?: string[] } }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicSlug, discussionSlug, data }) =>
      forumApi.updateDiscussion(topicSlug, discussionSlug, data),
    onSuccess: (_, { topicSlug, discussionSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.detail(topicSlug, discussionSlug) });
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.list(topicSlug) });
    },
  });
}

/**
 * useDeleteDiscussion Hook
 *
 * Deletes a discussion.
 * Invalidates discussion list cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useDeleteDiscussion(): UseMutationResult<
  void,
  Error,
  { topicSlug: string; discussionSlug: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicSlug, discussionSlug }) =>
      forumApi.deleteDiscussion(topicSlug, discussionSlug),
    onSuccess: (_, { topicSlug, discussionSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.list(topicSlug) });
      queryClient.removeQueries({ queryKey: forumDiscussionKeys.detail(topicSlug, discussionSlug) });
    },
  });
}

/**
 * useToggleSubscription Hook
 *
 * Toggles subscription to a discussion.
 * Invalidates discussion detail cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useToggleSubscription(): UseMutationResult<
  void,
  Error,
  { topicSlug: string; discussionSlug: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicSlug, discussionSlug }) =>
      forumApi.subscribe(topicSlug, discussionSlug),
    onSuccess: (_, { topicSlug, discussionSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.detail(topicSlug, discussionSlug) });
    },
  });
}

/**
 * useRecentDiscussions Hook
 *
 * Fetches recent discussions across all topics.
 *
 * @param {number} [limit] - Max results
 * @returns {UseQueryResult<ForumDiscussion[]>} Query result
 */
export function useRecentDiscussions(limit?: number): UseQueryResult<ForumDiscussion[], Error> {
  return useQuery({
    queryKey: [...forumDiscussionKeys.recent(), limit] as const,
    queryFn: () => forumApi.getRecentDiscussions(limit),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * usePopularDiscussions Hook
 *
 * Fetches popular discussions by timeframe.
 *
 * @param {string} [timeframe] - Timeframe filter (e.g., 'week', 'month')
 * @param {number} [limit] - Max results
 * @returns {UseQueryResult<ForumDiscussion[]>} Query result
 */
export function usePopularDiscussions(
  timeframe?: string,
  limit?: number
): UseQueryResult<ForumDiscussion[], Error> {
  return useQuery({
    queryKey: [...forumDiscussionKeys.popular(timeframe), limit] as const,
    queryFn: () => forumApi.getPopularDiscussions(timeframe, limit),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
