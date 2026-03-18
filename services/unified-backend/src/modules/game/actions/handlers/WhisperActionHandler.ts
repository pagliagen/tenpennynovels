/**
 * Whisper Action Handler
 *
 * Handles whisper (private) chat messages.
 * Requires targetCharacters array for private visibility.
 *
 * @module actions/handlers/WhisperActionHandler
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
 * Whisper Action Handler
 */
export class WhisperActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.WHISPER;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // Whisper messages require targetCharacters
    if (!input.targetCharacters || input.targetCharacters.length === 0) {
      return this.validationError(
        'targetCharacters is required for whisper messages',
        'MISSING_TARGET_CHARACTERS'
      );
    }

    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    const actionData = this.buildBaseActionData(input);

    // Add target characters for whisper
    actionData.targetCharacters = input.targetCharacters;

    this.log('debug', `Whisper message created`, {
      characterId: input.characterId,
      locationId: input.locationId,
      targetCount: input.targetCharacters?.length || 0
    });

    return actionData;
  }
}
