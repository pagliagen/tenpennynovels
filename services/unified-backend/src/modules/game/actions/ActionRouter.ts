/**
 * Action Router
 *
 * Central dispatcher that routes action creation requests to specialized handlers.
 * Replaces the monolithic switch statement in ChatController.createMessage().
 *
 * @module actions/ActionRouter
 * @since 2.1.0
 */

import { IActionHandler, ActionInput, ActionData, ChatActionType, ActionContext } from './types';

// Import implemented handlers — i tipi core restano locali, i tipi feature
// arrivano dall'api.ts della rispettiva feature (features/** puo' importare
// da modules/**, direzione sanzionata da lint:boundaries).
import { StandardActionHandler } from './handlers/StandardActionHandler';
import { WhisperActionHandler } from './handlers/WhisperActionHandler';
import { OocActionHandler } from './handlers/OocActionHandler';
import { DiceRollActionHandler } from './handlers/DiceRollActionHandler';
import { MasterActionHandler } from './handlers/MasterActionHandler';
import { ModerationActionHandler } from './handlers/ModerationActionHandler';
import { SkillCheckActionHandler } from '@features/skillCheck/api';
import { StatCheckActionHandler } from '@features/statCheck/api';
import { ItemUseActionHandler } from '@features/itemUse/api';
// social_confrontation/combat_action/confrontation_reaction_request non
// passano mai da qui: solo le route dedicate di features/confronti li
// gestiscono (vedi ConfrontationController). I vecchi handler "semplici"
// SocialConflictActionHandler/CombatActionHandler sono stati eliminati
// (raggiungibili solo via bypass isGestore per un gap nei permessi,
// residuo del sistema pre-TiroContrapposto) su decisione esplicita.

/**
 * Action Router
 *
 * Dispatches actions to appropriate handlers based on action type.
 */
export class ActionRouter {
  private handlers: Map<ChatActionType | string, IActionHandler> = new Map();
  private context: ActionContext;

  constructor(context: ActionContext) {
    this.context = context;
    this.registerHandlers();
  }

  /**
   * Register all action handlers
   */
  private registerHandlers(): void {
    const handlers: IActionHandler[] = [
      new StandardActionHandler(this.context),
      new WhisperActionHandler(this.context),
      new OocActionHandler(this.context),
      new DiceRollActionHandler(this.context),
      new SkillCheckActionHandler(this.context),
      new StatCheckActionHandler(this.context),
      new ItemUseActionHandler(this.context),
      new MasterActionHandler(this.context),
      new ModerationActionHandler(this.context)
    ];

    for (const handler of handlers) {
      const actionType = handler.getActionType();
      this.handlers.set(actionType, handler);
      this.context.logger.debug(`[ActionRouter] Registered handler for: ${actionType}`);
    }

    this.context.logger.info(`[ActionRouter] Initialized with ${handlers.length} handlers`);
  }

  /**
   * Route action to appropriate handler
   *
   * @param input - Action input data from controller
   * @returns ActionData ready for MongoDB save
   * @throws Error if no handler found or validation fails
   */
  async route(input: ActionInput): Promise<ActionData> {
    const handler = this.handlers.get(input.actionType as ChatActionType);

    if (!handler) {
      const error: any = new Error(`No handler found for action type: ${input.actionType}`);
      error.code = 'UNKNOWN_ACTION_TYPE';
      error.statusCode = 400;
      throw error;
    }

    // Validate input
    const validation = await handler.validate(input, this.context);
    if (!validation.valid && validation.error) {
      const error: any = new Error(validation.error.message);
      error.code = validation.error.code;
      error.statusCode = validation.error.statusCode;
      throw error;
    }

    // Process action
    const actionData = await handler.process(input, this.context);

    this.context.logger.debug(`[ActionRouter] Processed ${input.actionType} action`, {
      characterId: input.characterId,
      locationId: input.locationId,
      actionId: actionData.timestamp
    });

    return actionData;
  }

  /**
   * Get handler for specific action type (for testing)
   *
   * @param actionType - Action type
   * @returns Handler or undefined if not found
   */
  getHandler(actionType: ChatActionType | string): IActionHandler | undefined {
    return this.handlers.get(actionType);
  }

  /**
   * Get all registered action types (for testing)
   *
   * @returns Array of registered action types
   */
  getRegisteredActionTypes(): (ChatActionType | string)[] {
    return Array.from(this.handlers.keys());
  }
}
