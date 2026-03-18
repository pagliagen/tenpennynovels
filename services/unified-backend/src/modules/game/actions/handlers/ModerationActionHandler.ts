/**
 * Moderation Action Handler
 *
 * Handles moderation actions (moderator messages):
 * - Sets visibility to 'master_only' by default
 * - Used for moderator notes, warnings, administrative actions
 * - Simple handler similar to MasterActionHandler
 *
 * @module actions/handlers/ModerationActionHandler
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
 * Moderation Action Handler
 */
export class ModerationActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.MODERATION;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // No special validation required for moderation actions
    // Content validation is already done by controller
    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    const actionData = this.buildBaseActionData(input);

    // Force visibility to master_only for moderation actions
    actionData.visibility = 'master_only';

    this.log('info', `Moderation action created`, {
      characterId: input.characterId,
      locationId: input.locationId
    });

    return actionData;
  }
}
