/**
 * useForumSocial Hooks
 *
 * TanStack Query hooks for forum social features:
 * search, bookmarks, notifications, and follows.
 *
 * **Hooks**:
 * - useForumSearch(query) - Search forum posts
 * - useForumBookmarks() - List user bookmarks
 * - useToggleBookmark() - Toggle bookmark on a post
 * - useForumNotifications(page) - List user notifications
 * - useMarkNotificationsRead() - Mark notifications as read
 * - useUnreadNotificationCount() - Get unread count (polling)
 *
 * @module hooks/useForumSocial
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

import { forumApi } from '@/lib/api/forum';
import type { ForumSearchResult, ForumBookmark, ForumNotification, PaginationInfo } from '@/types/forum';

/**
 * Query Keys
 *
 * Centralized query keys for cache invalidation.
 */
export const forumSocialKeys = {
  search: (query: string) => ['forum', 'search', query] as const,
  bookmarks: () => ['forum', 'bookmarks'] as const,
  notifications: (page?: number) => ['forum', 'notifications', page] as const,
  unreadCount: () => ['forum', 'notifications', 'unread'] as const,
};

/**
 * useForumSearch Hook
 *
 * Searches forum posts by query string.
 * Disabled when query is empty.
 *
 * @param {string} query - Search query
 * @returns {UseQueryResult} Query result with search results and pagination
 */
export function useForumSearch(
  query: string
): UseQueryResult<{ list: ForumSearchResult[]; pagination: PaginationInfo }, Error> {
  return useQuery({
    queryKey: forumSocialKeys.search(query),
    queryFn: () => forumApi.searchForum(query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useForumBookmarks Hook
 *
 * Fetches user's bookmarked posts and discussions.
 *
 * @returns {UseQueryResult<ForumBookmark[]>} Query result
 */
export function useForumBookmarks(): UseQueryResult<ForumBookmark[], Error> {
  return useQuery({
    queryKey: forumSocialKeys.bookmarks(),
    queryFn: () => forumApi.getBookmarks(),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useToggleBookmark Hook
 *
 * Toggles a bookmark on a post.
 * Invalidates bookmarks cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useToggleBookmark(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => forumApi.toggleBookmark(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumSocialKeys.bookmarks() });
    },
  });
}

/**
 * useForumNotifications Hook
 *
 * Fetches paginated forum notifications for the current character.
 *
 * @param {number} [page] - Page number (1-based)
 * @returns {UseQueryResult} Query result with notifications and pagination
 */
export function useForumNotifications(
  page?: number
): UseQueryResult<{ list: ForumNotification[]; pagination: PaginationInfo }, Error> {
  return useQuery({
    queryKey: forumSocialKeys.notifications(page),
    queryFn: () => forumApi.getNotifications(page),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * useMarkNotificationsRead Hook
 *
 * Marks notifications as read by IDs.
 * Invalidates notifications and unread count cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useMarkNotificationsRead(): UseMutationResult<void, Error, string[]> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationIds: string[]) => forumApi.markNotificationsRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: forumSocialKeys.unreadCount() });
    },
  });
}

/**
 * useMarkAllNotificationsRead Hook
 *
 * Marks all notifications as read.
 * Invalidates notifications and unread count cache on success.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useMarkAllNotificationsRead(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => forumApi.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: forumSocialKeys.unreadCount() });
    },
  });
}

/**
 * useUnreadNotificationCount Hook
 *
 * Fetches unread notification count.
 * Polls every 60 seconds to keep badge updated.
 *
 * @returns {UseQueryResult<number>} Query result with unread count
 */
export function useUnreadNotificationCount(): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: forumSocialKeys.unreadCount(),
    queryFn: () => forumApi.getUnreadCount(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
