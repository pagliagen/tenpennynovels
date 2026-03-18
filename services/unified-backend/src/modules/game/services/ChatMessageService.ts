/**
 * Chat Message Service
 *
 * Service layer for chat message operations.
 * Follows LocationService pattern: returns typed DTOs, handles all transformations.
 *
 * Key Responsibilities:
 * - getMessages(): Fetch + enrich messages for GET endpoints
 * - createMessage(): Create + enrich for POST endpoints
 * - Uses MessageTransformer for type-specific enrichment
 * - Uses MessageContext to avoid N+1 queries
 *
 * @module services/ChatMessageService
 * @since 2.2.0
 */

import type { EnrichedChatMessage, GetMessagesParams, CreateMessageParams } from '../transformers/types';
import { MessageTransformer } from '../transformers/MessageTransformer';
import { MessageContext } from '../transformers/MessageContext';
import { Chat, Character, Location, GamingSession } from '@database/models';
import { ActionRouter } from '../actions/ActionRouter';
import { ActionInput } from '../actions/types';
import { logger } from '@shared/utils/logger';

/**
 * Chat Message Service
 */
export class ChatMessageService {
  private transformer: MessageTransformer;

  constructor() {
    this.transformer = new MessageTransformer();
    logger.info('[ChatMessageService] Initialized');
  }

  /**
   * Get messages for location (GET endpoint)
   *
   * @param params - Query parameters
   * @returns Enriched messages for API response
   */
  async getMessages(params: GetMessagesParams): Promise<EnrichedChatMessage[]> {
    const {
      locationId,
      characterId,
      timeThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000), // Default 3h
      limit = 100,
    } = params;

    logger.debug('[ChatMessageService.getMessages] Fetching messages:', {
      locationId,
      characterId,
      limit,
    });

    // Query messages from DB
    const actions = await Chat.find({
      locationId,
      timestamp: { $gte: timeThreshold },
      $or: [
        { visibility: 'public' },
        {
          visibility: 'whisper',
          $or: [{ characterId }, { targetCharacters: { $in: [characterId] } }],
        },
        { visibility: 'master_only' },
      ],
    })
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();

    logger.debug(`[ChatMessageService.getMessages] Fetched ${actions.length} raw messages`);

    // Fetch character for permission checks
    const character = await Character.findById(characterId).lean();
    if (!character) {
      logger.warn(`[ChatMessageService.getMessages] Character not found: ${characterId}`);
      return [];
    }

    // Check if action mode is active
    const isActionMode = await this.isActionModeActive(locationId);

    logger.debug('[ChatMessageService.getMessages] Action mode:', { isActionMode });

    // Filter by security rules (visibility, roles, action mode)
    const filtered = actions.filter((action) =>
      this.canSeeAction(action, character, isActionMode)
    );

    logger.debug(`[ChatMessageService.getMessages] ${filtered.length} messages after filtering`);

    // Transform batch with context (avoids N+1)
    const context = new MessageContext();
    const enriched = await this.transformer.transformBatch(filtered, context);

    logger.info('[ChatMessageService.getMessages] Complete:', {
      total: enriched.length,
      cacheStats: context.getStats(),
    });

    return enriched;
  }

  /**
   * Create message (POST endpoint)
   *
   * @param params - Message creation parameters
   * @returns Enriched message for API response
   */
  async createMessage(params: CreateMessageParams): Promise<EnrichedChatMessage> {
    logger.debug('[ChatMessageService.createMessage] Creating message:', {
      actionType: params.actionType,
      characterId: params.characterId,
      locationId: params.locationId,
    });

    // Step 1: Build ActionInput
    const actionInput: ActionInput = {
      actionType: params.actionType,
      content: params.content,
      locationId: params.locationId,
      characterId: params.characterId,
      characterName: params.characterName,
      characterAvatar: params.characterAvatar,
      isMasked: params.isMasked,
      realCharacterName: params.realCharacterName,
      visibility: params.visibility,
      targetCharacters: params.targetCharacters,
      diceSpec: params.diceSpec,
      skillId: params.skillId,
      statName: params.statName,
      itemId: params.itemId,
      position: params.position,
      isHidden: params.isHidden,
      sessionId: params.sessionId,
      characterRoles: params.characterRoles,
    };

    // Step 2: Route to handler (existing ActionRouter)
    // TODO: Get ActionRouter instance (will need to be injected or singleton)
    // const actionRouter = getActionRouter();
    // const actionData = await actionRouter.route(actionInput);

    // For now, throw not implemented
    throw new Error(
      '[ChatMessageService.createMessage] Integration with ActionRouter not yet complete'
    );

    // Step 3: Save to DB
    // const savedAction = await Chat.createAction(actionData);

    // Step 4: Transform for API response
    // const context = new MessageContext();
    // const enriched = await this.transformer.transform(savedAction, context);

    // logger.info('[ChatMessageService.createMessage] Complete:', {
    //   messageId: enriched._id,
    //   actionType: enriched.actionType,
    // });

    // return enriched;
  }

  /**
   * Check if character can see action (visibility + role permissions)
   * Includes action mode checks and social conflict visibility rules
   *
   * @param action - Raw chat action
   * @param character - Character document
   * @param isActionModeActive - Whether location action mode is active
   * @returns true if character can see this action
   */
  private canSeeAction(
    action: any,
    character: any,
    isActionModeActive: boolean = false
  ): boolean {
    const characterRoles = character.gameplayRoles || [];
    const isMaster =
      characterRoles.includes('master') ||
      characterRoles.includes('moderatore') ||
      characterRoles.includes('Gestore');

    // Master-only messages: only masters can see
    if (action.visibility === 'master_only') {
      return isMaster;
    }

    // Whispers: only participants can see
    if (action.visibility === 'whisper') {
      const isAuthor = action.characterId === character._id.toString();
      const isTarget =
        action.targetCharacters &&
        action.targetCharacters.includes(character._id.toString());

      return isAuthor || isTarget || isMaster;
    }

    // Hidden actions (action mode): only show to sender until revealed
    if (action.isHidden && !action.revealedAt && isActionModeActive) {
      return action.characterId === character._id.toString();
    }

    // CRITICAL SECURITY: Filter Raggirare failure notifications
    // visibleToDefenderOnly: only defender and master can see
    if (action.socialConflict?.visibleToDefenderOnly) {
      if (isMaster) return true;
      const isDefender = action.targetCharacters?.includes(character._id.toString());
      return isDefender;
    }

    // CRITICAL SECURITY: skill_check messages (social conflicts)
    // Only sender and master can see skill checks
    if (action.actionType === 'skill_check') {
      if (isMaster) return true;
      return action.characterId === character._id.toString();
    }

    // CRITICAL SECURITY: stat_check messages
    // Only sender and master can see stat checks
    if (action.actionType === 'stat_check') {
      if (isMaster) return true;
      return action.characterId === character._id.toString();
    }

    // Public: everyone can see
    return true;
  }

  /**
   * Check if location has active action mode
   *
   * @param locationId - Location ID
   * @returns true if action mode is active
   */
  private async isActionModeActive(locationId: string): Promise<boolean> {
    try {
      const location = await Location.findById(locationId).lean();
      if (!location?.activeSession?.sessionId) {
        return false;
      }

      const session = await GamingSession.findById(location.activeSession.sessionId).lean();
      if (!session?.actionModeActive || !session.actionModeEndsAt) {
        return false;
      }

      return new Date() < new Date(session.actionModeEndsAt);
    } catch (error) {
      logger.error('[ChatMessageService] Failed to check action mode:', error);
      return false;
    }
  }
}
