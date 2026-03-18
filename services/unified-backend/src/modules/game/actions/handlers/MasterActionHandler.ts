/**
 * Master Action Handler
 *
 * Handles master actions (Game Master messages):
 * - Sets visibility to 'master_only' by default
 * - Used for GM narration, system messages, plot revelations
 * - Simple handler similar to StandardActionHandler but for master-only content
 *
 * @module actions/handlers/MasterActionHandler
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
 * Master Action Handler
 */
export class MasterActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.MASTER;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // No special validation required for master actions
    // Content validation is already done by controller
    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    const actionData = this.buildBaseActionData(input);

    // Force visibility to master_only for master actions
    actionData.visibility = 'master_only';

    this.log('info', `Master action created`, {
      characterId: input.characterId,
      locationId: input.locationId
    });

    return actionData;
  }
}
