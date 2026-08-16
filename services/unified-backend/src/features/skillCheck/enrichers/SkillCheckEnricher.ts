/**
 * Skill Check Enricher
 *
 * Enriches skill_check actions with resolved skill names.
 * Fetches Skill document from MessageContext (cached).
 *
 * Before: { diceResult: { skillId: '123', ... } }
 * After:  { skillCheck: { skillId: '123', skillName: 'Pistol', ... } }
 *
 * @module transformers/enrichers/SkillCheckEnricher
 * @since 2.2.0
 */

import type { IMessageEnricher } from '@modules/game/transformers/enrichers/IMessageEnricher';
import type { EnrichedChatMessage, EnrichedSkillCheck } from '@modules/game/transformers/types';
import type { MessageContext } from '@modules/game/transformers/MessageContext';
import { logger } from '@shared/utils/logger';

/**
 * Enricher for skill check actions
 */
export class SkillCheckEnricher implements IMessageEnricher {
  canEnrich(actionType: string): boolean {
    return actionType === 'skill_check';
  }

  async enrich(action: any, context: MessageContext): Promise<Partial<EnrichedChatMessage>> {
    // Check if action has skill data to enrich
    if (!action.diceResult?.skillId) {
      logger.debug('[SkillCheckEnricher] No skillId found, skipping enrichment');
      return {};
    }

    // Get skill from context (cached)
    const skill = await context.getSkill(action.diceResult.skillId);
    if (!skill) {
      logger.warn(`[SkillCheckEnricher] Skill not found: ${action.diceResult.skillId}`);
      return {};
    }

    // Build enriched skill check
    const enrichedSkillCheck: EnrichedSkillCheck = {
      dice: action.diceResult.dice || '1d100',
      result: action.diceResult.result,
      rolls: action.diceResult.rolls,
      modifier: action.diceResult.modifier,
      total: action.diceResult.total,
      skillId: action.diceResult.skillId,
      skillName: skill.name, // ← ENRICHED from Skill document
      success: action.diceResult.success || false,
      successDegree: action.diceResult.successDegree || 'failure',
    };

    logger.debug(`[SkillCheckEnricher] Enriched skill: ${skill.name}`);

    return { skillCheck: enrichedSkillCheck };
  }
}
