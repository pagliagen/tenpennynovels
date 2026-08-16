/**
 * Message Transformer - Main Orchestrator
 *
 * Transforms MongoDB Chat documents into enriched API responses.
 * Delegates to type-specific enrichers for additional data.
 *
 * Key Features:
 * - transformBatch() with preloading eliminates N+1 queries
 * - Type-specific enrichment via enricher chain
 * - Empty subdocument filtering
 *
 * @module transformers/MessageTransformer
 * @since 2.2.0
 */

import type { EnrichedChatMessage } from './types';
import type { MessageContext } from './MessageContext';
import type { IMessageEnricher } from './enrichers/IMessageEnricher';

// Import enrichers — i tipi core restano locali, i tipi feature arrivano
// dall'api.ts della rispettiva feature.
import { WhisperEnricher } from './enrichers/WhisperEnricher';
import { DiceRollEnricher } from './enrichers/DiceRollEnricher';
import { BaseEnricher } from './enrichers/BaseEnricher';
import { SkillCheckEnricher } from '@features/skillCheck/api';
import { StatCheckEnricher } from '@features/statCheck/api';
import { ItemUseEnricher } from '@features/itemUse/api';
import { ConfrontationEnricher } from '@features/confronti/api';
import { logger } from '@shared/utils/logger';

/**
 * Main orchestrator for message transformation
 */
export class MessageTransformer {
  private enrichers: IMessageEnricher[];

  constructor() {
    // Order matters: BaseEnricher should run last (common fields)
    this.enrichers = [
      new SkillCheckEnricher(),
      new StatCheckEnricher(),
      new ItemUseEnricher(),
      new WhisperEnricher(),
      new DiceRollEnricher(),
      new ConfrontationEnricher(),
      new BaseEnricher(), // Always last
    ];

    logger.info('[MessageTransformer] Initialized with enrichers:', {
      count: this.enrichers.length,
    });
  }

  /**
   * Transform single message
   *
   * @param action - Raw chat action from MongoDB
   * @param context - Request-scoped cache
   * @returns Enriched message for API response
   */
  async transform(action: any, context: MessageContext): Promise<EnrichedChatMessage> {
    // Base transformation (DB → API format)
    const enriched: EnrichedChatMessage = {
      _id: action._id.toString(),
      actionType: action.actionType,
      characterId: action.characterId,
      characterName: action.characterName,
      characterAvatar: action.characterAvatar,
      position: action.position,
      locationId: action.locationId.toString(),
      content: action.content,
      timestamp: action.timestamp.toISOString(),
      visibility: action.visibility,
      // editHistory contains the pre-edit content — master-only, never shown to players.
      editHistory: context.isViewerMaster ? (action.editHistory || []) : [],
    };

    // Apply type-specific enrichment
    for (const enricher of this.enrichers) {
      if (enricher.canEnrich(action.actionType)) {
        try {
          const enrichment = await enricher.enrich(action, context);
          Object.assign(enriched, enrichment);
        } catch (error) {
          logger.error(
            `[MessageTransformer] Enricher failed for ${action.actionType}:`,
            error
          );
        }
      }
    }

    // Copy raw subdocuments if they exist (fallback for non-enriched types)
    if (action.socialConflict) {
      enriched.socialConflict = action.socialConflict;
    }
    // targetCharacters: WhisperEnricher only fires for actionType === 'whisper',
    // but other actionTypes (confrontation_reaction_request, master, moderation)
    // can also carry visibility: 'whisper'/'master_only' with real targets. The
    // client re-derives its own whisper visibility from this raw field (see
    // isMessageVisible in MessageList.tsx), so it must survive regardless of
    // actionType - without it a valid target sees the visibility check silently
    // fail and the message never renders, even though the server already decided
    // to send it to them.
    if (action.targetCharacters && action.targetCharacters.length > 0) {
      enriched.targetCharacters = action.targetCharacters;
    }
    // hiddenContent (e.g. the Raggirare lie text) is master-only, never shown to players —
    // same convention as editHistory above.
    if (action.hiddenContent && context.isViewerMaster) {
      enriched.hiddenContent = action.hiddenContent;
    }

    // Filter empty subdocuments
    this.removeEmptyFields(enriched);

    return enriched;
  }

  /**
   * Transform batch of messages (with preloading to avoid N+1)
   *
   * @param actions - Array of raw chat actions from MongoDB
   * @param context - Request-scoped cache
   * @returns Array of enriched messages
   */
  async transformBatch(
    actions: any[],
    context: MessageContext
  ): Promise<EnrichedChatMessage[]> {
    if (actions.length === 0) {
      return [];
    }

    logger.debug(`[MessageTransformer] Transforming batch of ${actions.length} messages`);

    // Step 1: Extract all IDs that need to be loaded
    const characterIds = new Set<string>();
    const skillIds = new Set<string>();
    const itemIds = new Set<string>();

    for (const action of actions) {
      // Character authors
      characterIds.add(action.characterId);

      // Whisper targets
      if (action.targetCharacters && Array.isArray(action.targetCharacters)) {
        action.targetCharacters.forEach((id: string) => characterIds.add(id));
      }

      // Skill IDs from skill checks
      if (action.actionType === 'skill_check' && action.diceResult?.skillId) {
        skillIds.add(action.diceResult.skillId);
      }

      // Item IDs from item use
      if (action.actionType === 'item_use' && action.itemEffect?.itemId) {
        itemIds.add(action.itemEffect.itemId);

        // Consumed items
        if (action.itemEffect.consumedItems) {
          action.itemEffect.consumedItems.forEach((consumed: any) => {
            if (consumed.itemId) {
              itemIds.add(consumed.itemId);
            }
          });
        }
      }
    }

    logger.debug('[MessageTransformer] Preloading data:', {
      characters: characterIds.size,
      skills: skillIds.size,
      items: itemIds.size,
    });

    // Step 2: Batch preload (3 queries total for entire batch)
    await Promise.all([
      context.preloadCharacters([...characterIds]),
      context.preloadSkills([...skillIds]),
      context.preloadItems([...itemIds]),
    ]);

    logger.debug('[MessageTransformer] Preload complete, cache stats:', context.getStats());

    // Step 3: Transform all messages (now cached, no more queries)
    const enriched = await Promise.all(
      actions.map((action) => this.transform(action, context))
    );

    logger.debug(`[MessageTransformer] Batch transformation complete: ${enriched.length} messages`);

    return enriched;
  }

  /**
   * Remove empty/undefined fields and empty subdocuments
   */
  private removeEmptyFields(enriched: EnrichedChatMessage): void {
    // Remove undefined/null fields
    (Object.keys(enriched) as Array<keyof EnrichedChatMessage>).forEach((key) => {
      if (enriched[key] === undefined || enriched[key] === null) {
        delete enriched[key];
      }
    });

    // Remove empty subdocuments
    if (enriched.socialConflict && Object.keys(enriched.socialConflict).length === 0) {
      delete enriched.socialConflict;
    }
    if (enriched.editHistory && enriched.editHistory.length === 0) {
      delete enriched.editHistory;
    }
  }
}
