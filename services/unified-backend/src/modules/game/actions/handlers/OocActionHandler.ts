/**
 * OOC Action Handler
 *
 * Handles out-of-character chat messages.
 * No special logic required - just returns base action data.
 *
 * @module actions/handlers/OocActionHandler
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
 * OOC (Out of Character) Action Handler
 */
export class OocActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.OOC;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // OOC messages have no special validation requirements
    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    // OOC messages just return base action data
    const actionData = this.buildBaseActionData(input);

    this.log('debug', `OOC message created`, {
      characterId: input.characterId,
      locationId: input.locationId
    });

    return actionData;
  }
}
