/**
 * Whisper Enricher
 *
 * Enriches whisper actions with target character names.
 * Fetches Character documents from MessageContext (cached).
 *
 * Before: { targetCharacters: ['id1', 'id2'] }
 * After:  { whisper: { targetCharacterIds: ['id1', 'id2'], targetCharacterNames: ['Alice', 'Bob'] } }
 *
 * @module transformers/enrichers/WhisperEnricher
 * @since 2.2.0
 */

import type { IMessageEnricher } from './IMessageEnricher';
import type { EnrichedChatMessage, EnrichedWhisper } from '../types';
import type { MessageContext } from '../MessageContext';
import { logger } from '@shared/utils/logger';

/**
 * Enricher for whisper actions
 */
export class WhisperEnricher implements IMessageEnricher {
  canEnrich(actionType: string): boolean {
    return actionType === 'whisper';
  }

  async enrich(action: any, context: MessageContext): Promise<Partial<EnrichedChatMessage>> {
    // Check if action has whisper targets
    if (!action.targetCharacters || action.targetCharacters.length === 0) {
      logger.debug('[WhisperEnricher] No targetCharacters found, skipping enrichment');
      return {};
    }

    // Fetch target characters (from cache)
    const targetNames: string[] = [];
    for (const characterId of action.targetCharacters) {
      const character = await context.getCharacter(characterId);
      if (character) {
        targetNames.push(character.name);
      } else {
        logger.warn(`[WhisperEnricher] Target character not found: ${characterId}`);
        targetNames.push('Unknown'); // Fallback
      }
    }

    // Build enriched whisper data
    const enrichedWhisper: EnrichedWhisper = {
      targetCharacterIds: action.targetCharacters,
      targetCharacterNames: targetNames, // ← ENRICHED from Character documents
    };

    logger.debug(`[WhisperEnricher] Enriched whisper targets: ${targetNames.join(', ')}`);

    return { whisper: enrichedWhisper };
  }
}
