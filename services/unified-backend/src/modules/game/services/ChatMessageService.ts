/**
 * Chat Message Service
 *
 * Service layer for chat message operations.
 * Follows LocationService pattern: returns typed DTOs, handles all transformations.
 *
 * Key Responsibilities:
 * - getMessages(): Fetch + enrich messages for GET endpoints
 * - Uses MessageTransformer for type-specific enrichment
 * - Uses MessageContext to avoid N+1 queries
 *
 * @module services/ChatMessageService
 * @since 2.2.0
 */

import type { EnrichedChatMessage, GetMessagesParams } from '../transformers/types';
import { MessageTransformer } from '../transformers/MessageTransformer';
import { MessageContext } from '../transformers/MessageContext';
import { ChatBackup, Character, Location, GamingSession } from '@database/models';
import { ActionRouter } from '../actions/ActionRouter';
import { ActionInput } from '../actions/types';
import { logger } from '@shared/utils/logger';
import { hasGamePermission, GamePermissions } from '@config/permissions';

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
   * @returns Enriched messages with pagination info
   */
  async getMessages(params: GetMessagesParams): Promise<{
    messages: EnrichedChatMessage[],
    totalCount: number,
    hasMore: boolean
  }> {
    const {
      locationId,
      characterId,
      timeThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000), // Default 3h
      limit = 100,
      offset = 0,
    } = params;

    logger.debug('[ChatMessageService.getMessages] Fetching messages:', {
      locationId,
      characterId,
      limit,
      offset,
    });

    // Fetch character + compute isMaster FIRST — the query itself must be
    // viewer-aware so totalCount/hasMore and the fetched page never include
    // a document this character isn't allowed to see (no metagame leak via
    // pagination metadata, not just via message content).
    const character = await Character.findById(characterId).lean();
    if (!character) {
      logger.warn(`[ChatMessageService.getMessages] Character not found: ${characterId}`);
      return {
        messages: [],
        totalCount: 0,
        hasMore: false
      };
    }

    const isMaster = hasGamePermission(
      GamePermissions.CHAT_MASTER_ACTION,
      character.playerStatus || 'approved',
      character.isGestore || false,
      character.gameplayRoles || [],
      character.characterPermissions || []
    );

    // Build query — mirrors canSeeAction's visibility rules exactly, so the
    // DB never returns (or counts) a document the viewer can't see.
    // Reads only from ChatBackup (the ~3h TTL live view) — never from the
    // permanent Chat archive. See the architecture comment in Chat.ts.
    const visibilityOr: any[] = [{ visibility: 'public' }];
    if (isMaster) {
      // Master sees every whisper and every master_only message, targeted or not.
      visibilityOr.push({ visibility: 'whisper' });
      visibilityOr.push({ visibility: 'master_only' });
    } else {
      visibilityOr.push({
        visibility: 'whisper',
        $or: [{ characterId }, { targetCharacters: { $in: [characterId] } }],
      });
      visibilityOr.push({
        visibility: 'master_only',
        targetCharacters: { $in: [characterId] },
      });
    }

    const query = {
      locationId,
      timestamp: { $gte: timeThreshold },
      $or: visibilityOr,
    };

    // Count total BEFORE applying pagination
    const totalCount = await ChatBackup.countDocuments(query);

    // Query messages from DB with pagination
    const actions = await ChatBackup.find(query)
      .sort({ timestamp: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    logger.debug(`[ChatMessageService.getMessages] Fetched ${actions.length} raw messages (total: ${totalCount})`);

    // Filter by the remaining rules the query can't express as a simple visibility
    // match: skill/stat check sender-only visibility, and the Raggirare
    // visibleToDefenderOnly case. These are rarer and layered on top of an
    // already-authorized 'public' document, so a residual (message-count-
    // only, never content) pagination/totalCount skew can still occur for them —
    // see the conversation notes; closing that fully means replicating this whole
    // method in query form, which we've deliberately not done.
    const filtered = actions.filter((action) =>
      this.canSeeAction(action, character)
    );

    logger.debug(`[ChatMessageService.getMessages] ${filtered.length} messages after filtering`);

    // Transform batch with context (avoids N+1) — isMaster gates editHistory visibility,
    // viewerCharacterId gates confrontation result fields (Raggirare hides the outcome from its own author)
    const context = new MessageContext(isMaster, characterId);
    const enriched = await this.transformer.transformBatch(filtered, context);

    // Calculate hasMore
    const hasMore = offset + enriched.length < totalCount;

    logger.info('[ChatMessageService.getMessages] Complete:', {
      total: enriched.length,
      totalCount,
      offset,
      hasMore,
      cacheStats: context.getStats(),
    });

    return {
      messages: enriched,
      totalCount,
      hasMore
    };
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
    // Use centralized permission system instead of duplicating logic
    // Check if character has any master-only permission (indicates master/moderatore/gestore status)
    const isMaster = hasGamePermission(
      GamePermissions.CHAT_MASTER_ACTION,
      character.playerStatus || 'approved',
      character.isGestore || false,
      character.gameplayRoles || [],
      character.characterPermissions || []
    );

    // Master-only messages: masters always see them; if the master targeted
    // specific characters ("esito riservato"), those characters see it too.
    if (action.visibility === 'master_only') {
      if (isMaster) return true;
      return !!(
        action.targetCharacters &&
        action.targetCharacters.includes(character._id.toString())
      );
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
