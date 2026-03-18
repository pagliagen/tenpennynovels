/**
 * Stat Check Enricher
 *
 * Enriches stat_check actions with formatted stat data.
 * No DB lookups needed - stat name is already in action.
 *
 * Before: { diceResult: { ... }, statName: 'forza' }
 * After:  { statCheck: { statName: 'forza', ... } }
 *
 * @module transformers/enrichers/StatCheckEnricher
 * @since 2.2.0
 */

import type { IMessageEnricher } from './IMessageEnricher';
import type { EnrichedChatMessage, EnrichedStatCheck } from '../types';
import type { MessageContext } from '../MessageContext';
import { logger } from '@shared/utils/logger';

/**
 * Enricher for stat check actions
 */
export class StatCheckEnricher implements IMessageEnricher {
  canEnrich(actionType: string): boolean {
    return actionType === 'stat_check';
  }

  async enrich(action: any, _context: MessageContext): Promise<Partial<EnrichedChatMessage>> {
    // Check if action has stat data
    if (!action.diceResult) {
      logger.debug('[StatCheckEnricher] No diceResult found, skipping enrichment');
      return {};
    }

    // Stat name should be in action (stored directly, not ID)
    const statName = (action as any).statName || action.diceResult.statName;
    if (!statName) {
      logger.warn('[StatCheckEnricher] No statName found in action');
      return {};
    }

    // Build enriched stat check
    const enrichedStatCheck: EnrichedStatCheck = {
      dice: action.diceResult.dice || '1d100',
      result: action.diceResult.result,
      rolls: action.diceResult.rolls,
      modifier: action.diceResult.modifier,
      total: action.diceResult.total,
      statName,
      success: action.diceResult.success || false,
      successDegree: action.diceResult.successDegree || 'failure',
    };

    logger.debug(`[StatCheckEnricher] Enriched stat check: ${statName}`);

    return { statCheck: enrichedStatCheck };
  }
}
