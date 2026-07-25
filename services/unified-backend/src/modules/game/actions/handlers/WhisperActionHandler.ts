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

    // A whisper cannot target only the sender (e.g. UI sent an empty "everyone" selection)
    const targetsOtherThanSelf = input.targetCharacters.filter((id) => id !== input.characterId);
    if (targetsOtherThanSelf.length === 0) {
      return this.validationError(
        'Nessun destinatario valido per il sussurro',
        'MISSING_TARGET_CHARACTERS'
      );
    }

    // Targets must be active occupants of the location (prevents whispering to
    // arbitrary character IDs who never actually joined the scene)
    const location = await context.Location.findById(input.locationId).select('occupants').lean();
    const activeOccupantIds = new Set(
      (location?.occupants || [])
        .filter((occ: any) => occ.isActive)
        .map((occ: any) => occ.characterId.toString())
    );

    const invalidTargets = targetsOtherThanSelf.filter((id) => !activeOccupantIds.has(id));
    if (invalidTargets.length > 0) {
      return this.validationError(
        'Uno o più destinatari del sussurro non sono presenti in questa location',
        'INVALID_WHISPER_TARGET'
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
