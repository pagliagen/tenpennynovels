/**
 * Stat Check Action Handler
 *
 * Handles stat_check actions (attribute checks: forza, destrezza, etc.):
 * - Validates character has the stat
 * - Rolls 1d100 against stat value (secure - value from DB)
 * - Calculates success degree (BRP system)
 * - Formats message with result
 *
 * @module actions/handlers/StatCheckActionHandler
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
 * Stat Check Action Handler
 */
export class StatCheckActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.STAT_CHECK;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // Validate statName provided
    if (!input.statName) {
      return this.validationError(
        'statName is required for stat checks',
        'MISSING_STAT_NAME'
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

    // Validate character has stat
    if (!context.characterSkillService.hasStat(character, input.statName)) {
      return this.validationError(
        'Character does not have this stat',
        'STAT_NOT_FOUND'
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

    // Get stat value from DB (secure - cannot be manipulated by client)
    const statValue = context.characterSkillService.getStatValue(character, input.statName!);
    if (statValue === null) {
      throw new Error('STAT_NOT_FOUND'); // Should never happen (validated)
    }

    // Roll dice (1d100 for stat checks)
    const rollResult = context.diceService.rollDice('1d100');

    // Calculate success degree (BRP system)
    const successDegree = context.calculateSuccessDegree(rollResult.result, statValue);
    const successLabel = context.getSuccessDegreeLabel(successDegree.degree);

    // Build action data
    const actionData = this.buildBaseActionData(input);

    // Capitalize stat name for display (e.g., "forza" → "Forza")
    const statDisplayName = input.statName!.charAt(0).toUpperCase() + input.statName!.slice(1);

    // Format message with success degree + roll (target stat value stays hidden - privacy)
    actionData.content = `${input.characterName} tira ${statDisplayName} facendo un ${successLabel} (${rollResult.result}/100)`;

    // Add dice result with stat metadata
    actionData.diceResult = {
      ...rollResult,
      statName: input.statName,
      success: rollResult.result <= statValue,
      successDegree: successDegree.degree
    };

    actionData.successDegree = successDegree.degree;

    this.log('info', `Stat check: ${statDisplayName} = ${successLabel}`, {
      characterId: input.characterId,
      statName: input.statName,
      statValue,
      roll: rollResult.result,
      successDegree: successDegree.degree
    });

    return actionData;
  }
}
