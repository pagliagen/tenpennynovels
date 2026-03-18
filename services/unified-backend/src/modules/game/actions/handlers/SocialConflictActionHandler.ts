/**
 * Social Conflict Action Handler
 *
 * Handles social_confrontation actions (social opposed rolls):
 * - Used for persuasion, deception, intimidation, etc.
 * - Creates confrontation with social conflict data
 * - NOTE: Full confrontation logic is in ChatController.createConfrontationAttack
 * - This handler is for simple social conflict messages without full TiroContrapposto system
 *
 * @module actions/handlers/SocialConflictActionHandler
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
 * Social Conflict Action Handler
 */
export class SocialConflictActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.SOCIAL_CONFRONTATION;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // No special validation required
    // Full confrontation system validation is in separate endpoints
    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    const actionData = this.buildBaseActionData(input);

    // NOTE: This is a simple social conflict message
    // For full TiroContrapposto (opposed rolls), use ChatController.createConfrontationAttack endpoint
    // which creates confrontation_reaction_request messages with proper phase management

    this.log('info', `Social conflict action created`, {
      characterId: input.characterId,
      locationId: input.locationId
    });

    return actionData;
  }
}
