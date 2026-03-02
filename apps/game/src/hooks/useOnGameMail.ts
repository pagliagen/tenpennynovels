/**
 * OnGame Mail Hooks
 *
 * React Query hooks for the Victorian postal system.
 * Handles queries, mutations, and WebSocket subscriptions for mail operations.
 *
 * @module hooks/useOnGameMail
 * @since 2.0.0
 */

'use client';

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onGameMailApi } from '@/lib/api/onGameMail';
import { queryKeys } from '@/lib/api/queryClient';
import { useWebSocket } from '@/contexts/WebSocketContext';
import type {
  OnGameThread,
  OnGameThreadMessage,
  OnGamePartner,
  MessageTypeConfig,
  PublicCharacter,
  WalletInfo,
  SendMessagePayload,
} from '@/types/mail';

/**
 * Use OnGame Threads
 *
 * Fetches list of all conversations for current character.
 * Sorted by last message time (most recent first).
 *
 * @returns {UseQueryResult<OnGameThread[]>} Thread list query result
 *
 * @example
 * ```typescript
 * const { data: threads, isLoading, error } = useOnGameThreads();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage />;
 *
 * return threads.map(thread => (
 *   <ThreadItem key={thread.partnerId} thread={thread} />
 * ));
 * ```
 */
export function useOnGameThreads(): UseQueryResult<OnGameThread[], Error> {
  return useQuery({
    queryKey: queryKeys.onGameMail.threads,
    queryFn: () => onGameMailApi.getThreads().then((r) => r.threads),
    staleTime: 30 * 1000, // 30 seconds - mail changes more often than character sheets
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Use OnGame Thread
 *
 * Fetches all messages in a conversation with a specific partner.
 * Also marks all unread messages from that partner as read.
 *
 * @param {string} partnerId - Partner character ID
 * @returns {UseQueryResult<{ partner: OnGamePartner; messages: OnGameThreadMessage[] }>} Thread query result
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useOnGameThread(partnerId);
 *
 * if (!data) return null;
 *
 * return (
 *   <div>
 *     <h3>{data.partner.name}</h3>
 *     {data.messages.map(msg => (
 *       <MessageItem key={msg._id} message={msg} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useOnGameThread(
  partnerId: string
): UseQueryResult<{ partner: OnGamePartner; messages: OnGameThreadMessage[] }, Error> {
  return useQuery({
    queryKey: queryKeys.onGameMail.thread(partnerId),
    queryFn: () => onGameMailApi.getThread(partnerId),
    staleTime: 15 * 1000, // 15 seconds
    enabled: !!partnerId,
  });
}

/**
 * Use Message Types
 *
 * Fetches available message types for current character.
 * Backend filters by character roles (e.g., official_document requires staff role).
 * Config is stable, so staleTime is high (10 minutes).
 *
 * @returns {UseQueryResult<Record<string, MessageTypeConfig>>} Message types query result
 *
 * @example
 * ```typescript
 * const { data: types } = useMessageTypes();
 *
 * const noteConfig = types?.['note'];
 * console.log(noteConfig?.postageRequired); // 0
 * ```
 */
export function useMessageTypes(): UseQueryResult<Record<string, MessageTypeConfig>, Error> {
  return useQuery({
    queryKey: queryKeys.onGameMail.messageTypes,
    queryFn: () => onGameMailApi.getMessageTypes(),
    staleTime: 10 * 60 * 1000, // 10 minutes - config is stable
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Use OnGame Unread Count
 *
 * Fetches total unread message count for TopBar badge.
 * Refetches on window focus to keep badge accurate.
 *
 * @returns {UseQueryResult<number>} Unread count query result
 *
 * @example
 * ```typescript
 * const { data: unreadCount = 0 } = useOnGameUnreadCount();
 *
 * return (
 *   <TopBar unreadOnGameMailCount={unreadCount} />
 * );
 * ```
 */
export function useOnGameUnreadCount(): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: queryKeys.onGameMail.unreadCount,
    queryFn: () => onGameMailApi.getUnreadCount(),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Use Public Characters
 *
 * Fetches list of all characters available as message recipients.
 * Includes DRAFT, PENDING_APPROVAL, and APPROVED characters.
 *
 * @returns {UseQueryResult<PublicCharacter[]>} Public characters query result
 *
 * @example
 * ```typescript
 * const { data: characters = [] } = usePublicCharacters();
 * const currentCharId = useAuthStore(state => state.selectedCharacter?._id);
 *
 * // Filter out self
 * const recipients = characters.filter(c => c._id !== currentCharId);
 * ```
 */
export function usePublicCharacters(): UseQueryResult<PublicCharacter[], Error> {
  return useQuery({
    queryKey: queryKeys.characters.publicList,
    queryFn: () => onGameMailApi.getPublicCharacters(),
    staleTime: 5 * 60 * 1000, // 5 minutes - character list doesn't change often
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Use Wallet
 *
 * Fetches current character's wallet balance (cash + deposit).
 * Used for postage affordability check before sending.
 *
 * @returns {UseQueryResult<WalletInfo>} Wallet query result
 *
 * @example
 * ```typescript
 * const { data: wallet } = useWallet();
 * const canAfford = wallet && wallet.total >= postageCost;
 *
 * return (
 *   <button disabled={!canAfford}>
 *     Send ({postageCost}p)
 *   </button>
 * );
 * ```
 */
export function useWallet(): UseQueryResult<WalletInfo, Error> {
  return useQuery({
    queryKey: queryKeys.economy.wallet,
    queryFn: () => onGameMailApi.getWallet(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Use Send OnGame Message
 *
 * Mutation for sending OnGame messages.
 * Automatically invalidates threads, unread count, and wallet on success.
 *
 * @returns {UseMutationResult} Send message mutation result
 *
 * @example
 * ```typescript
 * const sendMessage = useSendOnGameMessage();
 *
 * const handleSend = async () => {
 *   try {
 *     const result = await sendMessage.mutateAsync({
 *       messageType: 'note',
 *       to: [recipientId],
 *       subject: 'Quick note',
 *       content: 'See you tonight.',
 *       deliveryTarget: { type: 'character' },
 *       isExpress: false
 *     });
 *     console.log(`Message sent! ID: ${result.messageId}`);
 *   } catch (error) {
 *     console.error('Failed to send:', error);
 *   }
 * };
 * ```
 */
export function useSendOnGameMessage(): UseMutationResult<
  { messageId: string; scheduledDelivery?: string; postageCharged: number },
  Error,
  SendMessagePayload
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SendMessagePayload) => onGameMailApi.sendMessage(payload),
    onSuccess: () => {
      // Invalidate threads and unread count
      queryClient.invalidateQueries({ queryKey: queryKeys.onGameMail.threads });
      queryClient.invalidateQueries({ queryKey: queryKeys.onGameMail.unreadCount });
      queryClient.invalidateQueries({ queryKey: queryKeys.economy.wallet });
    },
  });
}

/**
 * Use OnGame Mail WebSocket
 *
 * Subscribes to WebSocket events for real-time mail updates.
 * Invalidates queries when messages are delivered or sent.
 *
 * **CRITICAL**: This hook subscribes via `onMessageEvent()`, NOT direct `socket.on()`.
 * This follows the project pattern of never calling `socket.on()` directly in components.
 *
 * **Usage**:
 * - Call in `OnGameMailPanel` component for thread updates when window is open
 * - ALSO call in `GameLayout` for unread badge updates when window is closed
 *
 * @param {string | null} selectedPartnerId - Currently viewed partner ID (for targeted invalidation)
 *
 * @example
 * ```typescript
 * // In OnGameMailPanel
 * useOnGameMailWebSocket(selectedPartnerId);
 *
 * // In GameLayout (for badge updates)
 * useOnGameMailWebSocket(null);
 * ```
 */
export function useOnGameMailWebSocket(selectedPartnerId: string | null): void {
  const queryClient = useQueryClient();
  const { onMessageEvent } = useWebSocket();

  useEffect(() => {
    const unsubscribe = onMessageEvent((event) => {
      if (event.type === 'ongame:message_delivered') {
        // Invalidate threads and unread count
        queryClient.invalidateQueries({ queryKey: queryKeys.onGameMail.threads });
        queryClient.invalidateQueries({ queryKey: queryKeys.onGameMail.unreadCount });

        // If currently viewing the thread with the sender, refresh it too
        if (selectedPartnerId && event.data.fromCharacterId === selectedPartnerId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.onGameMail.thread(selectedPartnerId),
          });
        }
      }

      if (event.type === 'ongame:message_sent') {
        // Our own message was sent+delivered - refresh threads
        queryClient.invalidateQueries({ queryKey: queryKeys.onGameMail.threads });

        // Refresh current thread if we're viewing it
        if (selectedPartnerId && event.data.toCharacterIds?.includes(selectedPartnerId)) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.onGameMail.thread(selectedPartnerId),
          });
        }
      }
    });

    return unsubscribe;
  }, [selectedPartnerId, onMessageEvent, queryClient]);
}
