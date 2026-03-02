/**
 * Location Chats API Service
 *
 * Handles all HTTP API calls related to location chat functionality.
 * Uses the singleton apiClient for consistent auth and error handling.
 *
 * **Pattern**: HTTP for reliable writes, WebSocket for real-time reads.
 *
 * Endpoints:
 * - GET /game/chats/:locationId - Fetch message history
 * - POST /game/chats - Send new message
 * - PATCH /game/chats/:messageId - Edit message (3-minute window)
 * - DELETE /game/chats/:messageId - Delete message (3-minute window)
 *
 * @module lib/api/locationChats
 * @since 2.0.0
 */

import { api } from './client';
import type {
  ChatMessage,
  SendMessageRequest,
  EditMessageRequest,
  MessageHistoryResponse,
  SendMessageResponse,
} from '@/types/chat';

/**
 * Location Chats API Service
 *
 * Service layer for location chat operations.
 */
export const locationChatsApi = {
  /**
   * Get Message History
   *
   * Fetches chat messages for a location.
   * Returns last 3 hours of messages (backend enforced).
   *
   * @param {string} locationId - Location ID (NOT slug - backend uses IDs)
   * @param {number} [limit=100] - Max messages to fetch
   * @param {number} [offset=0] - Pagination offset
   * @returns {Promise<MessageHistoryResponse>} Message history
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const history = await locationChatsApi.getHistory('abc123');
   * console.log(`Loaded ${history.messages.length} messages`);
   * ```
   */
  async getHistory(
    locationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<MessageHistoryResponse> {
    const response = await api.get<MessageHistoryResponse>(
      `/game/chats/${locationId}`,
      {
        params: { limit, offset },
      }
    );

    return response;
  },

  /**
   * Send Message
   *
   * Sends a new message to a location chat.
   * Backend handles permission checks (APPROVED character required).
   *
   * **Real-Time Flow**:
   * 1. HTTP POST saves message to DB
   * 2. Backend emits `location_message_notification` via WebSocket
   * 3. All clients receive message in < 1s (no refresh needed)
   *
   * @param {string} locationId - Location ID
   * @param {SendMessageRequest} data - Message data
   * @returns {Promise<ChatMessage>} Created message
   * @throws {ApiError} If request fails (403 if character not approved)
   *
   * @example
   * ```typescript
   * // Standard message
   * const message = await locationChatsApi.sendMessage('abc123', {
   *   messageType: 'standard',
   *   text: 'Good evening, my lord.'
   * });
   *
   * // Whisper
   * const whisper = await locationChatsApi.sendMessage('abc123', {
   *   messageType: 'whisper',
   *   text: 'I have information about the baron...',
   *   targetCharacterId: 'xyz789'
   * });
   *
   * // Dice roll
   * const diceRoll = await locationChatsApi.sendMessage('abc123', {
   *   messageType: 'dice_roll',
   *   text: 'Rolling for perception',
   *   diceRoll: {
   *     notation: '2d6+3',
   *     result: 11,
   *     rolls: [4, 4],
   *     modifier: 3
   *   }
   * });
   * ```
   */
  async sendMessage(
    locationId: string,
    data: SendMessageRequest
  ): Promise<ChatMessage> {
    // Map frontend field names to backend field names
    const { messageType, text, ...rest } = data;

    const response = await api.post<SendMessageResponse>('/game/chats', {
      locationId,
      actionType: messageType,  // Backend expects 'actionType'
      content: text,            // Backend expects 'content'
      ...rest,
    });

    return response.message;
  },

  /**
   * Create Social Conflict
   *
   * Initiates a social conflict (opposed skill check) against another character.
   * Examples: Raggirare (Deceive) vs Percezione, Persuasione vs Empatia.
   *
   * **Social Conflict Types**:
   * - **Raggirare**: Hidden roll - target only notified if they detect the lie
   * - **Persuasione**: Visible roll - both parties see the outcome
   * - **Intimidazione**: Visible roll - opposed by Coraggio or Empatia
   *
   * **Real-Time Flow**:
   * 1. HTTP POST calculates opposed roll (attacker vs defender)
   * 2. Backend saves action + optional defender notification to DB
   * 3. Backend emits targeted WebSocket events:
   *    - Attacker receives their action (with hidden intent if Raggirare)
   *    - Defender receives notification if they detect deception
   *    - Bystanders see standard message only (no skill check details)
   *
   * @param {Object} params - Social conflict parameters
   * @param {string} params.locationId - Location ID
   * @param {string} params.attackerSkill - Attacker's skill (Raggirare, Persuasione, Intimidazione)
   * @param {string} params.defenderCharacterId - Target character ID
   * @param {string} params.content - Visible action text (what others see)
   * @param {string} [params.lieText] - Hidden intent (only for Raggirare - visible to master only)
   * @returns {Promise<ChatMessage>} Created action with social conflict data
   * @throws {ApiError} If request fails (400 if attacker doesn't have skill, 404 if defender not found)
   *
   * @example
   * ```typescript
   * // Raggirare (hidden roll)
   * const action = await locationChatsApi.createSocialConflict({
   *   locationId: 'abc123',
   *   attackerSkill: 'Raggirare',
   *   defenderCharacterId: 'xyz789',
   *   content: 'Good evening, nothing to worry about here...',
   *   lieText: 'Actually planning to pickpocket them'
   * });
   *
   * // Persuasione (visible roll)
   * const action = await locationChatsApi.createSocialConflict({
   *   locationId: 'abc123',
   *   attackerSkill: 'Persuasione',
   *   defenderCharacterId: 'xyz789',
   *   content: 'Please, you must help us investigate this matter.'
   * });
   * ```
   */
  async createSocialConflict(params: {
    locationId: string;
    attackerSkill: string;
    defenderCharacterId: string;
    content: string;
    lieText?: string;
  }): Promise<ChatMessage> {
    const response = await api.post<{ action: ChatMessage }>(
      '/game/chats/social-conflict',
      params
    );

    return response.action;
  },

  /**
   * Edit Message
   *
   * Edits an existing message (must be own message, within 3-minute window).
   * Backend enforces ownership and time limit.
   *
   * **Note**: Backend doesn't emit `message_updated` event yet.
   * Workaround: Call `getHistory()` after edit to refresh list.
   *
   * @param {string} messageId - Message ID to edit
   * @param {EditMessageRequest} data - Updated message data
   * @returns {Promise<ChatMessage>} Updated message
   * @throws {ApiError} If request fails (403 if time limit exceeded or not owner)
   *
   * @example
   * ```typescript
   * const updated = await locationChatsApi.editMessage('msg123', {
   *   text: 'Good evening, my lord. [Corrected typo]'
   * });
   * ```
   */
  async editMessage(
    messageId: string,
    data: EditMessageRequest
  ): Promise<ChatMessage> {
    const response = await api.patch<{ message: ChatMessage }>(
      `/game/chats/${messageId}`,
      data
    );

    return response.message;
  },

  /**
   * Delete Message
   *
   * Deletes a message (must be own message, within 3-minute window).
   * Backend enforces ownership and time limit.
   *
   * **Note**: Backend doesn't emit `message_deleted` event yet.
   * Workaround: Call `getHistory()` after delete to refresh list.
   *
   * @param {string} messageId - Message ID to delete
   * @returns {Promise<void>}
   * @throws {ApiError} If request fails (403 if time limit exceeded or not owner)
   *
   * @example
   * ```typescript
   * await locationChatsApi.deleteMessage('msg123');
   * // Refresh list after delete
   * await locationChatsApi.getHistory(locationId);
   * ```
   */
  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/game/chats/${messageId}`);
  },

  /**
   * Update Occupant Tag
   *
   * Updates current character's tag (sub-chat position) in a location.
   * Tags represent physical positions like "Tavolo 1", "Bancone", "Angolo Nord".
   *
   * **Tag Persistence**: Tag is saved to occupant record in DB.
   * Future messages will automatically include this tag.
   *
   * @param {string} locationId - Location ID
   * @param {string} currentTag - New tag value
   * @returns {Promise<void>}
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * // User selects "Tavolo 1" in TagSelector modal
   * await locationChatsApi.updateOccupantTag('abc123', 'Tavolo 1');
   * // All future messages will show "@ Tavolo 1"
   * ```
   */
  async updateOccupantTag(locationId: string, currentTag: string): Promise<void> {
    await api.patch(`/game/locations/${locationId}/occupant-tag`, {
      currentTag,
    });
  },

  /**
   * Get Location by Slug
   *
   * Helper method to convert location slug to ID for chat API calls.
   * Backend chat endpoints use IDs, but frontend routing uses slugs.
   *
   * @param {string} slug - Location slug (e.g., "westminster")
   * @returns {Promise<string>} Location ID
   * @throws {ApiError} If location not found
   *
   * @example
   * ```typescript
   * const locationId = await locationChatsApi.getLocationIdBySlug('westminster');
   * const history = await locationChatsApi.getHistory(locationId);
   * ```
   */
  async getLocationIdBySlug(slug: string): Promise<string> {
    // Note: This assumes a locations API endpoint exists
    // If not, we'll need to get locationId from locationStore instead
    const response = await api.get<{ location: { _id: string } }>(
      `/game/locations/slug/${slug}`
    );

    return response.location._id;
  },
};

/**
 * Re-export for backward compatibility
 */
export default locationChatsApi;
