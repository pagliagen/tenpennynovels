/**
 * OffGame Chat API Service
 *
 * API client for OffGame chat operations (WhatsApp-like instant messaging).
 * Handles chat list, messages, creation, typing indicators, read receipts.
 *
 * @module lib/api/offGameChat
 * @since 2.0.0
 */

import type {
  ChatPreview,
  ChatDetail,
  CreateChatPayload,
  SendMessagePayload,
} from '@/types/offGameChat';

import { api } from './client';

/** Payload lista chat (corpo HTTP dopo un livello di unwrap dal client). */
interface OffGameChatsListBody {
  list: ChatPreview[];
}

interface OffGameMessagesBody {
  data?: {
    messages?: ChatDetail['messages'];
  };
}

export const offGameChatApi = {
  /**
   * Get user's chats
   *
   * Fetches list of all chats (direct + groups) for the current character.
   * Includes last message, unread count, mute status.
   *
   * @returns {Promise<{ chats: ChatPreview[] }>}
   */
  async getChats(): Promise<{ chats: ChatPreview[] }> {
    const body = await api.get<OffGameChatsListBody>('/game/offgame-chats');
    return { chats: body.list };
  },

  /**
   * Get chat messages
   *
   * Fetches full message history for a specific chat.
   * Also fetches chat metadata from chats list.
   *
   * @param {string} chatId - Chat ID
   * @returns {Promise<ChatDetail>} Chat with messages
   */
  async getChatMessages(chatId: string): Promise<ChatDetail> {
    const body = await api.get<OffGameMessagesBody>(`/game/offgame-chats/${chatId}/messages`);
    const messages = body.data?.messages ?? [];

    // Fetch chat metadata from chats list
    const chatsResponse = await this.getChats();
    let chat = chatsResponse.chats.find((c) => c._id === chatId);

    // If chat not found in list (race condition after create), create placeholder
    if (!chat) {
      console.warn(`[OffGameChat] Chat ${chatId} not found in list, using placeholder`);
      chat = {
        _id: chatId,
        type: 'direct',
        participants: [],
        unreadCount: 0,
        isMuted: false,
        lastActivity: new Date().toISOString(),
      };
    }

    return { chat, messages };
  },

  /**
   * Create new chat
   *
   * Creates a direct (1:1) or group chat (up to 5 participants).
   *
   * @param {CreateChatPayload} payload - Chat creation data
   * @returns {Promise<any>} Created chat
   */
  async createChat(payload: CreateChatPayload) {
    return api.post('/game/offgame-chats', payload);
  },

  /**
   * Send message
   *
   * Sends a message to a chat. Triggers WebSocket broadcast to all participants.
   *
   * @param {string} chatId - Chat ID
   * @param {SendMessagePayload} payload - Message data
   * @returns {Promise<any>} Sent message
   */
  async sendMessage(chatId: string, payload: SendMessagePayload) {
    return api.post(`/game/offgame-chats/${chatId}/messages`, payload);
  },

  /**
   * Send typing indicator
   *
   * Broadcasts typing status to other chat participants via WebSocket.
   *
   * @param {string} chatId - Chat ID
   * @param {boolean} isTyping - True if typing, false if stopped
   * @returns {Promise<any>}
   */
  async sendTypingIndicator(chatId: string, isTyping: boolean) {
    return api.post(`/game/offgame-chats/${chatId}/typing`, { isTyping });
  },

  /**
   * Update chat name
   *
   * Renames a group chat (admin only). Triggers WebSocket broadcast.
   *
   * @param {string} chatId - Chat ID
   * @param {string} name - New group name
   * @returns {Promise<any>}
   */
  async updateChatName(chatId: string, name: string) {
    return api.patch(`/game/offgame-chats/${chatId}/name`, { name });
  },

  /**
   * Leave chat
   *
   * Removes current character from chat participants.
   *
   * @param {string} chatId - Chat ID
   * @returns {Promise<any>}
   */
  async leaveChat(chatId: string) {
    return api.post(`/game/offgame-chats/${chatId}/leave`);
  },
};
