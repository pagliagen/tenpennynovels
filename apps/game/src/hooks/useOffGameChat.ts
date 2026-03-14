/**
 * OffGame Chat Hooks
 *
 * React Query hooks for OffGame chat operations (WhatsApp-like instant messaging).
 * Provides queries, mutations, and WebSocket integration with typing indicators.
 *
 * @module hooks/useOffGameChat
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { offGameChatApi } from '@/lib/api/offGameChat';
import { queryKeys } from '@/lib/api/queryClient';
import { useWebSocket } from '@/contexts/WebSocketContext';
import type {
  ChatPreview,
  ChatDetail,
  CreateChatPayload,
  SendMessagePayload,
  TypingIndicator,
} from '@/types/offGameChat';

/**
 * Fetch user's chats
 *
 * Fetches list of all chats (direct + groups) for the current character.
 *
 * @returns {UseQueryResult<ChatPreview[], Error>}
 */
export function useOffGameChats(): UseQueryResult<ChatPreview[], Error> {
  return useQuery({
    queryKey: queryKeys.offGameChat.chats,
    queryFn: () => offGameChatApi.getChats().then((r) => r.chats),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch single chat with messages
 *
 * Fetches full message history for a specific chat.
 *
 * @param {string} chatId - Chat ID
 * @returns {UseQueryResult<ChatDetail, Error>}
 */
export function useOffGameChat(chatId: string): UseQueryResult<ChatDetail, Error> {
  return useQuery({
    queryKey: queryKeys.offGameChat.chat(chatId),
    queryFn: () => offGameChatApi.getChatMessages(chatId),
    enabled: !!chatId,
    staleTime: 15 * 1000, // 15 seconds
  });
}

/**
 * Total unread count
 *
 * Calculates sum of unread messages across all chats.
 *
 * @returns {UseQueryResult<number, Error>}
 */
export function useOffGameUnreadCount(): UseQueryResult<number, Error> {
  const { data: chats } = useOffGameChats();

  return useQuery({
    queryKey: queryKeys.offGameChat.unreadCount,
    queryFn: () => {
      const total = chats?.reduce((sum, chat) => sum + chat.unreadCount, 0) || 0;
      return Promise.resolve(total);
    },
    enabled: !!chats,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Send message mutation
 *
 * Sends a message to a chat. Invalidates chat list and unread count on success.
 *
 * @returns {UseMutationResult}
 */
export function useSendOffGameMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, payload }: { chatId: string; payload: SendMessagePayload }) =>
      offGameChatApi.sendMessage(chatId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offGameChat.chats });
      queryClient.invalidateQueries({ queryKey: queryKeys.offGameChat.unreadCount });
    },
  });
}

/**
 * Send typing indicator mutation
 *
 * Broadcasts typing status to other chat participants via WebSocket.
 *
 * @returns {UseMutationResult}
 */
export function useSendTypingIndicator() {
  return useMutation({
    mutationFn: ({ chatId, isTyping }: { chatId: string; isTyping: boolean }) =>
      offGameChatApi.sendTypingIndicator(chatId, isTyping),
  });
}

/**
 * Create chat mutation
 *
 * Creates a direct (1:1) or group chat (up to 5 participants).
 * Invalidates chat list on success.
 *
 * @returns {UseMutationResult}
 */
export function useCreateOffGameChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateChatPayload) => offGameChatApi.createChat(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offGameChat.chats });
    },
  });
}

/**
 * WebSocket integration hook
 *
 * Subscribes to WebSocket events and manages typing indicators state.
 * Invalidates queries on message received, typing, read receipts, chat updates.
 *
 * @param {string | null} selectedChatId - Currently selected chat ID
 * @returns {{ typingUsers: Map<string, Set<string>> }} Typing users by chat ID
 */
export function useOffGameChatWebSocket(selectedChatId: string | null): {
  typingUsers: Map<string, Set<string>>;
} {
  const queryClient = useQueryClient();
  const { onMessageEvent } = useWebSocket();
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const unsubscribe = onMessageEvent((event) => {
      // Message received: invalidate chat list, selected chat, and unread count
      if (event.type === 'offgame_message_received') {
        queryClient.invalidateQueries({ queryKey: queryKeys.offGameChat.chats });
        if (selectedChatId && event.data.chatId === selectedChatId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.offGameChat.chat(selectedChatId),
          });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.offGameChat.unreadCount });
      }

      // Typing indicator: update local state
      if (event.type === 'offgame_typing_indicator') {
        const { chatId, characterId, isTyping } = event.data as TypingIndicator;

        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          const chatTypers = newMap.get(chatId) || new Set();

          if (isTyping) {
            chatTypers.add(characterId);
          } else {
            chatTypers.delete(characterId);
          }

          newMap.set(chatId, chatTypers);
          return newMap;
        });

        if (isTyping) {
          const timeoutKey = `${chatId}_${characterId}`;
          const existing = typingTimeoutsRef.current.get(timeoutKey);
          if (existing) clearTimeout(existing);

          const timeout = setTimeout(() => {
            setTypingUsers((prev) => {
              const newMap = new Map(prev);
              const chatTypers = newMap.get(chatId);
              if (chatTypers) {
                chatTypers.delete(characterId);
                newMap.set(chatId, chatTypers);
              }
              return newMap;
            });
            typingTimeoutsRef.current.delete(timeoutKey);
          }, 5000);
          typingTimeoutsRef.current.set(timeoutKey, timeout);
        }
      }

      // Read receipt: invalidate selected chat to update readBy array
      if (event.type === 'offgame_message_read') {
        if (selectedChatId && event.data.chatId === selectedChatId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.offGameChat.chat(selectedChatId),
          });
        }
      }

      // Chat updated (e.g., name change): invalidate chat list and selected chat
      if (event.type === 'offgame_chat_updated') {
        queryClient.invalidateQueries({ queryKey: queryKeys.offGameChat.chats });
        if (selectedChatId && event.data.chatId === selectedChatId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.offGameChat.chat(selectedChatId),
          });
        }
      }
    });

    return unsubscribe;
  }, [selectedChatId, onMessageEvent, queryClient]);

  useEffect(() => {
    return () => {
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
    };
  }, []);

  return { typingUsers };
}
