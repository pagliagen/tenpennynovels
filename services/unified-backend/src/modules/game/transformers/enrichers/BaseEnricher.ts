/**
 * Base Enricher - Common Fields
 *
 * Handles enrichment of fields common to all action types:
 * - Character avatar (if missing, fetch from DB)
 *
 * Always runs last after type-specific enrichers.
 *
 * @module transformers/enrichers/BaseEnricher
 * @since 2.2.0
 */

import type { IMessageEnricher } from './IMessageEnricher';
import type { EnrichedChatMessage } from '../types';
import type { MessageContext } from '../MessageContext';
import { logger } from '@shared/utils/logger';

/**
 * Base enricher for common fields
 */
export class BaseEnricher implements IMessageEnricher {
  /**
   * Always enriches (runs for all types)
   */
  canEnrich(_actionType: string): boolean {
    return true;
  }

  /**
   * Enrich common fields
   * - Populates character avatar if missing
   */
  async enrich(action: any, context: MessageContext): Promise<Partial<EnrichedChatMessage>> {
    const enrichment: Partial<EnrichedChatMessage> = {};

    // Populate avatar if missing (respects fake PNG avatars)
    if (!action.characterAvatar) {
      try {
        const character = await context.getCharacter(action.characterId);
        if (character?.avatar) {
          enrichment.characterAvatar = character.avatar;
        }
      } catch (error) {
        logger.warn(
          `[BaseEnricher] Failed to fetch avatar for character: ${action.characterId}`,
          error
        );
      }
    }

    return enrichment;
  }
}
