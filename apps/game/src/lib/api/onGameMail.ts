/**
 * OnGame Mail API Service
 *
 * Handles all HTTP API calls for the Victorian postal system.
 * Uses the singleton apiClient for consistent auth and error handling.
 *
 * **Backend Inconsistency**: Backend returns `id` instead of `_id` in some responses.
 * This service normalizes all `id` fields to `_id` to match project standard.
 *
 * Endpoints:
 * - GET /game/ongame-messages/threads - Fetch conversation list
 * - GET /game/ongame-messages/thread/:partnerId - Fetch single conversation
 * - GET /game/ongame-messages/types - Fetch available message types
 * - GET /game/characters/public-list - Fetch all characters for recipient selector
 * - GET /game/economy/wallet - Fetch wallet balance
 * - GET /game/ongame-messages/inbox - Fetch inbox (for unread count)
 * - POST /game/ongame-messages - Send new message
 *
 * @module lib/api/onGameMail
 * @since 2.0.0
 */

import { api } from './client';
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
 * OnGame Mail API Service
 *
 * Service layer for OnGame mail operations.
 *
 * @since 2.0.0
 */
export const onGameMailApi = {
  /**
   * Get Thread List
   *
   * Fetches list of all conversations for current character.
   * Each thread includes partner info, last message, and unread count.
   * Backend sorts by lastMessage.sentAt DESC.
   *
   * **Backend Fix**: Normalizes `lastMessage.id` → `lastMessage._id`
   *
   * @returns {Promise<{ threads: OnGameThread[] }>} Thread list
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const { threads } = await onGameMailApi.getThreads();
   * console.log(`You have ${threads.length} conversations`);
   * ```
   */
  async getThreads(): Promise<{ threads: OnGameThread[] }> {
    const response = await api.get<{ result: boolean; data: { threads: any[] } }>(
      '/game/ongame-messages/threads'
    );

    // Normalize: backend returns id not _id in lastMessage
    const threads = (response.data?.threads || []).map((t: any) => ({
      ...t,
      lastMessage: {
        ...t.lastMessage,
        _id: t.lastMessage.id || t.lastMessage._id,
      },
    }));

    return { threads };
  },

  /**
   * Get Thread Messages
   *
   * Fetches all messages in a conversation with a specific partner.
   * Also marks all unread messages from that partner as read.
   *
   * **Backend Fix**: Normalizes `partner.id` → `partner._id` and `message.id` → `message._id`
   *
   * @param {string} partnerId - Partner character ID
   * @returns {Promise<{ partner: OnGamePartner; messages: OnGameThreadMessage[] }>} Thread data
   * @throws {ApiError} If request fails (404 if partner not found)
   *
   * @example
   * ```typescript
   * const { partner, messages } = await onGameMailApi.getThread('abc123');
   * console.log(`Conversation with ${partner.name}: ${messages.length} messages`);
   * ```
   */
  async getThread(partnerId: string): Promise<{ partner: OnGamePartner; messages: OnGameThreadMessage[] }> {
    const response = await api.get<{ result: boolean; data: { partner: any; messages: any[] } }>(
      `/game/ongame-messages/thread/${partnerId}`
    );

    // Normalize: backend returns id not _id
    const partner = {
      ...response.data.partner,
      _id: response.data.partner.id || response.data.partner._id,
    };

    const messages = (response.data.messages || []).map((m: any) => ({
      ...m,
      _id: m.id || m._id,
    }));

    return { partner, messages };
  },

  /**
   * Get Message Types
   *
   * Fetches available message types for current character.
   * Backend filters by character roles (e.g., official_document requires staff role).
   *
   * @returns {Promise<Record<string, MessageTypeConfig>>} Message types keyed by type key
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const types = await onGameMailApi.getMessageTypes();
   * console.log(types['note'].postageRequired); // 0
   * console.log(types['telegram'].postageRequired); // 3
   * ```
   */
  async getMessageTypes(): Promise<Record<string, MessageTypeConfig>> {
    const response = await api.get<{ result: boolean; data: Record<string, MessageTypeConfig> }>(
      '/game/ongame-messages/types'
    );
    return response.data;
  },

  /**
   * Get Public Characters
   *
   * Fetches list of all characters available as message recipients.
   * Includes DRAFT, PENDING_APPROVAL, and APPROVED characters.
   *
   * **Backend Inconsistency**: Backend returns `id` instead of `_id`.
   * This method normalizes to `_id` for consistency.
   *
   * @returns {Promise<PublicCharacter[]>} Public character list
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const characters = await onGameMailApi.getPublicCharacters();
   * const recipients = characters.filter(c => c._id !== currentCharacter._id);
   * ```
   */
  async getPublicCharacters(): Promise<PublicCharacter[]> {
    const response = await api.get<{ result: boolean; data: { characters: any[] } }>(
      '/game/characters/public-list'
    );
    return (response.data?.characters || []).map((c: any) => ({
      _id: c._id || c.id, // normalize _id
      name: c.name,
      avatar: c.avatar,
    }));
  },

  /**
   * Get Wallet Balance
   *
   * Fetches current character's wallet balance (cash + deposit).
   * Used for postage affordability check before sending.
   *
   * @returns {Promise<WalletInfo>} Wallet balance
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const wallet = await onGameMailApi.getWallet();
   * if (wallet.total >= postage) {
   *   // Can afford to send
   * }
   * ```
   */
  async getWallet(): Promise<WalletInfo> {
    const response = await api.get<{ result: boolean; data: { cash: number; deposit: number } }>(
      '/game/economy/wallet'
    );
    return {
      cash: response.data.cash || 0,
      deposit: response.data.deposit || 0,
      total: (response.data.cash || 0) + (response.data.deposit || 0),
    };
  },

  /**
   * Get Unread Count
   *
   * Fetches total unread message count for current character.
   * Uses inbox endpoint with limit=1 which returns unreadCount in response.
   *
   * @returns {Promise<number>} Unread message count
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const unreadCount = await onGameMailApi.getUnreadCount();
   * // Display badge on TopBar
   * ```
   */
  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ result: boolean; data: { unreadCount: number } }>(
      '/game/ongame-messages/inbox?limit=1'
    );
    return response.data?.unreadCount || 0;
  },

  /**
   * Send Message
   *
   * Sends a new OnGame message.
   * Backend handles postage deduction, delivery scheduling, and WebSocket notifications.
   *
   * **Real-Time Flow**:
   * 1. HTTP POST saves message and deducts postage
   * 2. Backend calculates delivery time based on message type
   * 3. Backend emits `ongame:message_sent` to sender
   * 4. If realtime delivery: emits `ongame:message_delivered` to recipients immediately
   * 5. If scheduled: cron job delivers later and emits `ongame:message_delivery_confirmed`
   *
   * @param {SendMessagePayload} payload - Message payload
   * @returns {Promise<{ messageId: string; scheduledDelivery?: string; postageCharged: number }>} Send result
   * @throws {ApiError} If request fails (403 if banned, 400 if insufficient funds)
   *
   * @example
   * ```typescript
   * const result = await onGameMailApi.sendMessage({
   *   messageType: 'note',
   *   to: ['abc123'],
   *   subject: 'Quick note',
   *   content: 'See you at the ball tonight.',
   *   deliveryTarget: { type: 'character' },
   *   isExpress: false
   * });
   * console.log(`Message sent! Delivery: ${result.scheduledDelivery}`);
   * ```
   */
  async sendMessage(payload: SendMessagePayload): Promise<{
    messageId: string;
    scheduledDelivery?: string;
    postageCharged: number;
  }> {
    const response = await api.post<{ result: boolean; data: any }>(
      '/game/ongame-messages',
      payload
    );
    return response.data;
  },
};
