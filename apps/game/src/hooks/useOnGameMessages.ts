/**
 * OnGame Messages React Query Hooks
 *
 * Server state management for Victorian postal system
 * WebSocket subscriptions for real-time updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useEffect } from 'react';
import {
  onGameMessagesApi,
  type SendMessageRequest,
} from '@/lib/api/onGameMessages';

// ============================================
// Query Keys
// ============================================

export const onGameMessagesKeys = {
  all: ['onGameMessages'] as const,
  threads: () => [...onGameMessagesKeys.all, 'threads'] as const,
  threadsList: (page?: number, limit?: number) =>
    [...onGameMessagesKeys.threads(), 'list', { page, limit }] as const,
  thread: (threadId: string) => [...onGameMessagesKeys.threads(), threadId] as const,
  inbox: (page?: number, limit?: number) =>
    [...onGameMessagesKeys.all, 'inbox', { page, limit }] as const,
  sent: (page?: number, limit?: number) =>
    [...onGameMessagesKeys.all, 'sent', { page, limit }] as const,
};

// ============================================
// Hooks - Queries
// ============================================

/**
 * List all threads (paginated)
 */
export function useOnGameThreads(page = 1, limit = 25, includeDeleted = false) {
  const { onMessageEvent } = useWebSocket();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: onGameMessagesKeys.threadsList(page, limit),
    queryFn: () => onGameMessagesApi.getThreads(page, limit, includeDeleted),
    staleTime: 30 * 1000, // 30 seconds
  });

  // WebSocket real-time updates
  useEffect(() => {
    const unsubscribe = onMessageEvent((event) => {
      if (event.type === 'ongame:message_delivered' || event.type === 'ongame:message_sent') {
        // Invalidate threads list when new message arrives
        queryClient.invalidateQueries({ queryKey: onGameMessagesKeys.threads() });
      }
    });

    return unsubscribe;
  }, [onMessageEvent, queryClient]);

  return query;
}

/**
 * Get single thread with messages
 */
export function useOnGameThread(threadId: string | null) {
  const { onMessageEvent } = useWebSocket();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: onGameMessagesKeys.thread(threadId!),
    queryFn: () => onGameMessagesApi.getThread(threadId!),
    enabled: !!threadId,
    staleTime: 10 * 1000, // 10 seconds
  });

  // WebSocket real-time updates
  useEffect(() => {
    if (!threadId) return;

    const unsubscribe = onMessageEvent((event) => {
      if (
        (event.type === 'ongame:message_delivered' || event.type === 'ongame:message_read') &&
        event.data.threadId === threadId
      ) {
        // Refetch thread when new message arrives or message is read
        queryClient.invalidateQueries({ queryKey: onGameMessagesKeys.thread(threadId) });
      }
    });

    return unsubscribe;
  }, [threadId, onMessageEvent, queryClient]);

  return query;
}

/**
 * Get inbox (received messages)
 */
export function useOnGameInbox(page = 1, limit = 25) {
  const { onMessageEvent } = useWebSocket();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: onGameMessagesKeys.inbox(page, limit),
    queryFn: () => onGameMessagesApi.getInbox(page, limit),
    staleTime: 30 * 1000,
  });

  // WebSocket real-time updates
  useEffect(() => {
    const unsubscribe = onMessageEvent((event) => {
      if (event.type === 'ongame:message_delivered') {
        // Invalidate inbox when new message is delivered
        queryClient.invalidateQueries({ queryKey: onGameMessagesKeys.inbox() });
      }
    });

    return unsubscribe;
  }, [onMessageEvent, queryClient]);

  return query;
}

/**
 * Get sent messages
 */
export function useOnGameSent(page = 1, limit = 25) {
  const { onMessageEvent } = useWebSocket();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: onGameMessagesKeys.sent(page, limit),
    queryFn: () => onGameMessagesApi.getSent(page, limit),
    staleTime: 30 * 1000,
  });

  // WebSocket real-time updates
  useEffect(() => {
    const unsubscribe = onMessageEvent((event) => {
      if (event.type === 'ongame:message_sent') {
        // Invalidate sent messages when new message is sent
        queryClient.invalidateQueries({ queryKey: onGameMessagesKeys.sent() });
      }
    });

    return unsubscribe;
  }, [onMessageEvent, queryClient]);

  return query;
}

// ============================================
// Hooks - Mutations
// ============================================

/**
 * Send on-game message
 */
export function useSendOnGameMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageRequest) => onGameMessagesApi.sendMessage(data),
    onSuccess: () => {
      // Force immediate refetch (not just invalidate) to ensure fresh data
      // when OnGameInbox mounts after compose view closes
      queryClient.refetchQueries({ queryKey: onGameMessagesKeys.threads() });
      queryClient.invalidateQueries({ queryKey: onGameMessagesKeys.sent() });
    },
  });
}

/**
 * Delete on-game message
 */
export function useDeleteOnGameMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => onGameMessagesApi.deleteMessage(messageId),
    onSuccess: () => {
      // Invalidate all queries (message could be in inbox, sent, or thread)
      queryClient.invalidateQueries({ queryKey: onGameMessagesKeys.all });
    },
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Get total unread count across all threads
 * Used for badge display in TopBar
 */
export function useOnGameUnreadCount() {
  const { data } = useOnGameThreads(1, 100); // Fetch first 100 threads

  // Import authStore to get current character ID
  // NOTE: We'll need to import useAuthStore at the top of the file
  const selectedCharacter =
    typeof window !== 'undefined'
      ? // eslint-disable-next-line react-hooks/rules-of-hooks
        require('@/store/authStore').useAuthStore.getState().selectedCharacter
      : null;

  const unreadCount =
    data?.threads.reduce((total, thread) => {
      if (!selectedCharacter) return total;
      // Get unread count for current character only
      const characterUnread = thread.unreadCount[selectedCharacter._id] || 0;
      return total + characterUnread;
    }, 0) || 0;

  return { data: unreadCount };
}
