/**
 * Dice Roll Action Handler
 *
 * Handles generic dice rolls (1d4, 1d6, 2d6+3, 1d20, 1d100, etc.).
 * Uses DiceService for centralized dice rolling logic.
 *
 * @module actions/handlers/DiceRollActionHandler
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
 * Dice Roll Action Handler
 */
export class DiceRollActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.DICE_ROLL;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // Dice spec is optional (defaults to 1d100)
    // No validation required - DiceService handles invalid specs gracefully
    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    const actionData = this.buildBaseActionData(input);

    // Roll dice (defaults to 1d100 if not specified)
    const rollResult = context.diceService.rollDice(input.diceSpec || '1d100');
    actionData.diceResult = rollResult;

    // Format message as a single sentence, consistent with stat/skill checks
    actionData.content = `${input.characterName} tira ${rollResult.dice} facendo ${rollResult.total}`;

    this.log('debug', `Dice roll: ${rollResult.dice} = ${rollResult.total}`, {
      characterId: input.characterId,
      locationId: input.locationId,
      diceSpec: rollResult.dice,
      total: rollResult.total
    });

    return actionData;
  }
}
