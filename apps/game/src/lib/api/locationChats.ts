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

import type {
  ChatMessage,
  SendMessageRequest,
  EditMessageRequest,
  MessageHistoryResponse,
  SendMessageResponse,
} from '@/types/chat';

import { api } from './client';

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
    // No mapping needed - frontend uses DB field names directly
    const response = await api.post<SendMessageResponse>('/game/chats', {
      locationId,
      ...data,  // actionType and content already correct
    });

    return response.data.action;
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
   * Create Confrontation Attack
   *
   * Initiates a confrontation (social or combat) using the unified 2-phase flow.
   * Creates a reaction request message that the defender must respond to.
   *
   * @param data - Confrontation attack data
   * @returns {Promise<ChatMessage>} Created reaction request message
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const attack = await locationChatsApi.createConfrontationAttack({
   *   locationId: 'loc123',
   *   attackSkill: 'Intimidire',
   *   defenderId: 'char456',
   *   content: 'Mi avvicino minaccioso...',
   * });
   * ```
   */
  async createConfrontationAttack(data: {
    locationId: string;
    attackSkill: string;
    defenderId: string;
    content: string;
    additionalMessage?: string;
    forceAbortPendingReaction?: boolean;
  }): Promise<ChatMessage> {
    const response = await api.post<{ data: { action: ChatMessage } }>(
      '/game/chats/confrontation-attack',
      data
    );

    return response.data.action;
  },

  /**
   * React to Confrontation (TiroContrapposto Phase 1)
   *
   * Defender chooses their defense skill in response to a confrontation attack.
   * Updates the reaction request message in-place with the final roll results.
   *
   * **Real-Time Flow**:
   * 1. HTTP POST rolls dice and calculates opposed roll result
   * 2. Backend updates message atomically (prevents double-processing)
   * 3. Backend emits WebSocket event with SAME actionId (message updated)
   * 4. All clients see the updated message with final results
   *
   * @param {string} messageId - Reaction request message ID
   * @param {string} defenseSkillName - Chosen defense skill
   * @returns {Promise<ChatMessage>} Updated message with results
   * @throws {ApiError} If request fails (403 if not defender, 410 if already processed)
   *
   * @example
   * ```typescript
   * // Defender chooses Schivata to defend against Corpo a Corpo
   * const result = await locationChatsApi.reactToConfrontation('msg123', 'Schivata');
   * // Message updates from 'confrontation_reaction_request' to 'combat_action'
   * // Shows final rolls and outcome
   * ```
   */
  async reactToConfrontation(
    messageId: string,
    defenseSkillName: string
  ): Promise<ChatMessage> {
    const response = await api.post<{ data: { action: ChatMessage } }>(
      '/game/chats/confrontation-reaction',
      { messageId, defenseSkillName }
    );

    return response.data.action;
  },

  /**
   * Force Confrontation Outcome (Master Only)
   *
   * Forcibly resolves a pending confrontation with a custom outcome.
   * Used by masters to bypass stuck situations or apply narrative rulings.
   *
   * @param data - Force outcome data
   * @returns {Promise<ChatMessage>} Updated message with forced result
   * @throws {ApiError} If request fails (403 if not master)
   *
   * @example
   * ```typescript
   * // Master forces defender to win with extreme success
   * const result = await locationChatsApi.forceConfrontationOutcome({
   *   messageId: 'msg123',
   *   forcedOutcome: 'defender_wins',
   *   defenderSuccessLevel: 'extreme'
   * });
   * ```
   */
  async forceConfrontationOutcome(data: {
    messageId: string;
    forcedOutcome: 'attacker_wins' | 'defender_wins';
    defenderSuccessLevel?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
  }): Promise<ChatMessage> {
    const response = await api.post<{ data: { action: ChatMessage } }>(
      '/game/chats/force-confrontation-outcome',
      data
    );

    return response.data.action;
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
