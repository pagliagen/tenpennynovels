/**
 * useForumPreferences Hooks
 *
 * TanStack Query hooks for per-character forum preferences (reply order) and
 * the "unread bacheche" aggregate summary used for the global navbar badge.
 *
 * **Hooks**:
 * - useForumPreferences() - Get the character's saved reply order
 * - useUpdateForumPreferences() - Persist a new reply order
 * - useForumUnreadSummary() - Aggregate unread-topics summary (navbar badge)
 * - useMarkTopicVisited() - Clear a topic's unread state
 *
 * @module hooks/useForumPreferences
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

import { forumApi } from '@/lib/api/forum';
import { useAuthStore } from '@/store/authStore';
import type { ForumPreferences, ForumReplyOrder, ForumUnreadSummary } from '@/types/forum';

export const forumPreferenceKeys = {
  all: ['forum', 'preferences'] as const,
  unreadSummary: () => ['forum', 'unreadSummary'] as const,
};

/**
 * useForumPreferences Hook
 *
 * Fetches the current character's forum preferences (reply order).
 *
 * @returns {UseQueryResult<ForumPreferences>} Query result
 */
export function useForumPreferences(): UseQueryResult<ForumPreferences, Error> {
  return useQuery({
    queryKey: forumPreferenceKeys.all,
    queryFn: () => forumApi.getPreferences(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useUpdateForumPreferences Hook
 *
 * Persists the character's reply-order preference.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useUpdateForumPreferences(): UseMutationResult<
  ForumPreferences,
  Error,
  ForumReplyOrder
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (replyOrder: ForumReplyOrder) => forumApi.updatePreferences(replyOrder),
    onSuccess: (data) => {
      queryClient.setQueryData(forumPreferenceKeys.all, data);
    },
  });
}

/**
 * useForumUnreadSummary Hook
 *
 * Fetches the aggregate "bacheche con contenuti nuovi" summary, used to
 * render the unread badge on the forum button in the global navbar.
 *
 * Il polling è attivo solo con sessione utente + personaggio validi
 * (endpoint richiede entrambi): altrimenti genererebbe 401 in background
 * ogni 2 minuti anche a sessione scaduta o prima che un personaggio sia
 * selezionato.
 *
 * @returns {UseQueryResult<ForumUnreadSummary>} Query result
 */
export function useForumUnreadSummary(): UseQueryResult<ForumUnreadSummary, Error> {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasSelectedCharacter = useAuthStore((state) => !!state.selectedCharacter);

  return useQuery({
    queryKey: forumPreferenceKeys.unreadSummary(),
    queryFn: () => forumApi.getUnreadSummary(),
    enabled: isAuthenticated && hasSelectedCharacter,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

/**
 * useMarkTopicVisited Hook
 *
 * Marks a topic as visited by the current character, clearing its unread
 * state. Invalidates the unread summary so the navbar badge updates.
 *
 * @returns {UseMutationResult} Mutation result
 */
export function useMarkTopicVisited(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (topicSlug: string) => forumApi.markTopicVisited(topicSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumPreferenceKeys.unreadSummary() });
    },
  });
}
