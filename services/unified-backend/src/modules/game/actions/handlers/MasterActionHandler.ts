/**
 * Master Action Handler
 *
 * Handles master actions (Game Master messages):
 * - Default: visible to everyone (GM narration, system messages, plot revelations)
 * - If the master selects targetCharacters ("esito riservato"), visibility is
 *   forced to master_only and restricted to master + those characters
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

    if (input.targetCharacters && input.targetCharacters.length > 0) {
      // "Esito riservato": master targeted specific characters — the message
      // is visible only to master + those characters. Visibility is forced
      // server-side (not trusted from the client) whenever targets are set.
      actionData.targetCharacters = input.targetCharacters;
      actionData.visibility = 'master_only';
    } else {
      // Default: master narration/announcements are visible to everyone
      // (GM narration, plot revelations — see module doc). An explicit
      // master_only request (untargeted private note) is still honored.
      actionData.visibility = input.visibility === 'master_only' ? 'master_only' : 'public';
    }

    this.log('info', `Master action created`, {
      characterId: input.characterId,
      locationId: input.locationId,
      visibility: actionData.visibility,
      targetCount: input.targetCharacters?.length || 0
    });

    return actionData;
  }
}
