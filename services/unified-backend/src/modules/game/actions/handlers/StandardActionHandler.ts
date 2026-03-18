/**
 * Standard Action Handler
 *
 * Handles standard chat messages (regular roleplay actions).
 * No special logic required - just returns base action data.
 *
 * @module actions/handlers/StandardActionHandler
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
 * Standard Action Handler
 */
export class StandardActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.STANDARD;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // Standard messages have no special validation requirements
    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    // Standard messages just return base action data
    const actionData = this.buildBaseActionData(input);

    this.log('debug', `Standard message created`, {
      characterId: input.characterId,
      locationId: input.locationId
    });

    return actionData;
  }
}
