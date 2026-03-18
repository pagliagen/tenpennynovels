/**
 * Combat Action Handler
 *
 * Handles combat_action actions (combat opposed rolls):
 * - Used for melee, ranged, unarmed combat
 * - Creates confrontation with combat data including damage
 * - NOTE: Full combat system is in ChatController.createConfrontationAttack
 * - This handler is for simple combat messages without full TiroContrapposto system
 *
 * @module actions/handlers/CombatActionHandler
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
 * Combat Action Handler
 */
export class CombatActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.COMBAT_ACTION;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // No special validation required
    // Full combat system validation is in separate endpoints
    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    const actionData = this.buildBaseActionData(input);

    // NOTE: This is a simple combat message
    // For full TiroContrapposto (opposed rolls with damage), use ChatController.createConfrontationAttack endpoint
    // which creates confrontation_reaction_request messages with proper phase management and damage calculation

    this.log('info', `Combat action created`, {
      characterId: input.characterId,
      locationId: input.locationId
    });

    return actionData;
  }
}
