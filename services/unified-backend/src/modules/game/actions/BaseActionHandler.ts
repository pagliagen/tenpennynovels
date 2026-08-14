/**
 * Base Action Handler
 *
 * Abstract base class providing common functionality for all action handlers.
 * Follows the same pattern as BaseEventHandler for consistency.
 *
 * @module actions/BaseActionHandler
 * @since 2.1.0
 */

import {
  IActionHandler,
  ActionInput,
  ActionData,
  ValidationResult,
  ActionContext,
  ChatActionType
} from './types';

/**
 * Abstract base class for action handlers
 * Provides common functionality and enforces interface contract
 */
export abstract class BaseActionHandler implements IActionHandler {
  protected context: ActionContext;

  constructor(context: ActionContext) {
    this.context = context;
  }

  /**
   * Get action type (must be implemented by subclass)
   */
  abstract getActionType(): ChatActionType;

  /**
   * Validate input (must be implemented by subclass)
   */
  abstract validate(input: ActionInput, context: ActionContext): Promise<ValidationResult>;

  /**
   * Process action (must be implemented by subclass)
   */
  abstract process(input: ActionInput, context: ActionContext): Promise<ActionData>;

  /**
   * Build base action data with common fields
   * Subclasses call this and extend with type-specific fields
   */
  protected buildBaseActionData(input: ActionInput): ActionData {
    return {
      actionType: input.actionType as string,
      characterId: input.characterId,
      characterName: input.characterName,
      characterAvatar: input.characterAvatar,
      isMasked: input.isMasked,
      realCharacterName: input.realCharacterName,
      content: input.content.trim(),
      locationId: input.locationId,
      sessionId: input.sessionId,
      timestamp: new Date(),
      visibility: input.visibility || this.getDefaultVisibility(input.actionType as string),
      characterRoles: input.characterRoles,
      position: input.position,
      isHidden: input.isHidden || false
    };
  }

  /**
   * Get default visibility for action type
   */
  protected getDefaultVisibility(actionType: string): 'public' | 'whisper' | 'master_only' {
    switch (actionType) {
      case 'whisper':
        return 'whisper';
      case 'moderation':
      case 'master':
        return 'master_only';
      default:
        return 'public';
    }
  }

  /**
   * Create validation error result
   */
  protected validationError(message: string, code: string, statusCode: number = 400): ValidationResult {
    return {
      valid: false,
      error: { message, code, statusCode }
    };
  }

  /**
   * Create validation success result
   */
  protected validationSuccess(): ValidationResult {
    return { valid: true };
  }

  /**
   * Log handler activity
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    this.context.logger[level](`[${this.constructor.name}] ${message}`, data);
  }
}
