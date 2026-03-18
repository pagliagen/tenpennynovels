/**
 * Dice Roll Enricher
 *
 * Enriches dice_roll actions with formatted dice data.
 * No DB lookups needed - just formats dice result.
 *
 * Before: { diceResult: { dice: '2d6+3', result: 8, ... } }
 * After:  { diceResult: { dice: '2d6+3', result: 8, rolls: [2, 6], ... } }
 *
 * @module transformers/enrichers/DiceRollEnricher
 * @since 2.2.0
 */

import type { IMessageEnricher } from './IMessageEnricher';
import type { EnrichedChatMessage, EnrichedDiceResult } from '../types';
import type { MessageContext } from '../MessageContext';
import { logger } from '@shared/utils/logger';

/**
 * Enricher for dice roll actions
 */
export class DiceRollEnricher implements IMessageEnricher {
  canEnrich(actionType: string): boolean {
    return actionType === 'dice_roll';
  }

  async enrich(action: any, _context: MessageContext): Promise<Partial<EnrichedChatMessage>> {
    // Check if action has dice data
    if (!action.diceResult) {
      logger.debug('[DiceRollEnricher] No diceResult found, skipping enrichment');
      return {};
    }

    // Format dice result (no DB lookups needed)
    const enrichedDiceResult: EnrichedDiceResult = {
      dice: action.diceResult.dice || '1d100',
      result: action.diceResult.result,
      rolls: action.diceResult.rolls,
      modifier: action.diceResult.modifier,
      total: action.diceResult.total,
    };

    logger.debug(
      `[DiceRollEnricher] Formatted dice roll: ${enrichedDiceResult.dice} = ${enrichedDiceResult.total}`
    );

    return { diceResult: enrichedDiceResult };
  }
}
