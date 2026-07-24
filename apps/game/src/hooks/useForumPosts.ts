/**
 * useForumPosts Hooks
 *
 * TanStack Query hooks for forum post operations.
 * Handles server state with automatic caching, loading states, and error handling.
 *
 * **Hooks**:
 * - useForumPosts(topicSlug, discussionSlug, page) - List posts in a discussion
 * - useCreatePost() - Create new post
 * - useUpdatePost() - Update post content
 * - useDeletePost() - Delete post
 *
 * @module hooks/useForumPosts
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

import { forumApi } from '@/lib/api/forum';
import type { ForumPost, PaginationInfo } from '@/types/forum';

import { forumDiscussionKeys } from './useForumDiscussions';

/**
 * Query Keys
 *
 * Centralized query keys for cache invalidation.
 */
export const forumPostKeys = {
  all: ['forum', 'posts'] as const,
  list: (topicSlug: string, discussionSlug: string) =>
    [...forumPostKeys.all, 'list', topicSlug, discussionSlug] as const,
};

/**
 * useForumPosts Hook
 *
 * Fetches paginated posts for a discussion.
 * Disabled when either slug is null.
 *
 * @param {string | null} topicSlug - Topic slug
 * @param {string | null} discussionSlug - Discussion slug
 * @param {number} [page] - Page number (1-based)
 * @returns {UseQueryResult} Query result with items and pagination
 */
export function useForumPosts(
  topicSlug: string | null,
  discussionSlug: string | null,
  page?: number
): UseQueryResult<{ list: ForumPost[]; pagination: PaginationInfo }, Error> {
  return useQuery({
    queryKey: [...forumPostKeys.list(topicSlug!, discussionSlug!), page] as const,
    queryFn: () => forumApi.getPosts(topicSlug!, discussionSlug!, page),
    enabled: !!topicSlug && !!discussionSlug,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useCreatePost Hook
 *
 * Creates a new post in a discussion.
 * Invalidates posts list and discussion detail cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useCreatePost(): UseMutationResult<
  { id: string },
  Error,
  { topicSlug: string; discussionSlug: string; data: { content: string; replyToPostId?: string; isAnonymous?: boolean } }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicSlug, discussionSlug, data }) =>
      forumApi.createPost(topicSlug, discussionSlug, data),
    onSuccess: (_, { topicSlug, discussionSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumPostKeys.list(topicSlug, discussionSlug) });
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.detail(topicSlug, discussionSlug) });
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.list(topicSlug) });
    },
  });
}

/**
 * useUpdatePost Hook
 *
 * Updates post content.
 * Invalidates the post's parent discussion posts list on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useUpdatePost(): UseMutationResult<
  void,
  Error,
  { postId: string; content: string; topicSlug: string; discussionSlug: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, content }) => forumApi.updatePost(postId, content),
    onSuccess: (_, { topicSlug, discussionSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumPostKeys.list(topicSlug, discussionSlug) });
    },
  });
}

/**
 * useDeletePost Hook
 *
 * Deletes a post.
 * Invalidates posts list and discussion detail cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useDeletePost(): UseMutationResult<
  void,
  Error,
  { postId: string; topicSlug: string; discussionSlug: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId }) => forumApi.deletePost(postId),
    onSuccess: (_, { topicSlug, discussionSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumPostKeys.list(topicSlug, discussionSlug) });
      queryClient.invalidateQueries({ queryKey: forumDiscussionKeys.detail(topicSlug, discussionSlug) });
    },
  });
}

/**
 * useTogglePinPost Hook
 *
 * Pins/unpins a post. Staff-only server-side (pinning a new post automatically
 * unpins whichever was pinned before in the same discussion).
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useTogglePinPost(): UseMutationResult<
  void,
  Error,
  { postId: string; pinned: boolean; topicSlug: string; discussionSlug: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, pinned }) => forumApi.togglePinPost(postId, pinned),
    onSuccess: (_, { topicSlug, discussionSlug }) => {
      queryClient.invalidateQueries({ queryKey: forumPostKeys.list(topicSlug, discussionSlug) });
    },
  });
}
