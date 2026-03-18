/**
 * Skill Check Action Handler
 *
 * Handles skill_check actions:
 * - Validates character has the skill
 * - Rolls 1d100 against skill value (secure - value from DB)
 * - Calculates success degree (BRP system)
 * - Formats message with result
 *
 * @module actions/handlers/SkillCheckActionHandler
 * @since 2.1.0
 */

import { BaseActionHandler } from '../BaseActionHandler';
import {
  ActionInput,
  ActionData,
  ValidationResult,
  ActionContext,
  ChatActionType
} from '../types';

/**
 * Skill Check Action Handler
 */
export class SkillCheckActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.SKILL_CHECK;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // Validate skillId provided
    if (!input.skillId) {
      return this.validationError(
        'skillId is required for skill checks',
        'MISSING_SKILL_ID'
      );
    }

    // Fetch character from DB
    const character = await context.Character.findById(input.characterId).lean();
    if (!character) {
      return this.validationError(
        'Personaggio non trovato',
        'CHARACTER_NOT_FOUND',
        404
      );
    }

    // Validate character has skill
    if (!context.characterSkillService.hasSkill(character, input.skillId)) {
      return this.validationError(
        'Character does not have this skill',
        'SKILL_NOT_FOUND'
      );
    }

    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    // Fetch character (security: always fetch from DB, never trust client)
    const character = await context.Character.findById(input.characterId).lean();
    if (!character) {
      throw new Error('CHARACTER_NOT_FOUND'); // Should never happen (validated)
    }

    // Get skill value from DB (secure - cannot be manipulated by client)
    const skillValue = context.characterSkillService.getSkillValue(character, input.skillId!);
    if (skillValue === null) {
      throw new Error('SKILL_NOT_FOUND'); // Should never happen (validated)
    }

    // Fetch skill name from Skill model
    const skillDoc = await context.Skill.findById(input.skillId).select('name').lean();
    const skillName = skillDoc?.name || 'Unknown Skill';

    // Roll dice (1d100 for skill checks)
    const rollResult = context.diceService.rollDice('1d100');

    // Calculate success degree (BRP system: critical, extreme, hard, normal, failure, fumble)
    const successDegree = context.calculateSuccessDegree(rollResult.result, skillValue);
    const successLabel = context.getSuccessDegreeLabel(successDegree.degree);

    // Build action data
    const actionData = this.buildBaseActionData(input);

    // Format message with success degree (no dice numbers shown - privacy)
    actionData.content = `${input.characterName} tira ${skillName} facendo un ${successLabel}`;

    // Add dice result with skill metadata
    actionData.diceResult = {
      ...rollResult,
      skillId: input.skillId,
      skillName,
      success: rollResult.result <= skillValue,
      successDegree: successDegree.degree
    };

    actionData.successDegree = successDegree.degree;

    this.log('info', `Skill check: ${skillName} = ${successLabel}`, {
      characterId: input.characterId,
      skillName,
      skillValue,
      roll: rollResult.result,
      successDegree: successDegree.degree
    });

    return actionData;
  }
}
