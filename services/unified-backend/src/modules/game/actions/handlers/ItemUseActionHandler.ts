/**
 * Item Use Action Handler
 *
 * Handles item_use actions:
 * - Validates item exists in database
 * - Constructs itemEffect object with item details
 * - TODO: Future enhancement - implement actual item consumption/effects logic
 *
 * @module actions/handlers/ItemUseActionHandler
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
 * Item Use Action Handler
 */
export class ItemUseActionHandler extends BaseActionHandler {
  getActionType(): ChatActionType {
    return ChatActionType.ITEM_USE;
  }

  async validate(input: ActionInput, context: ActionContext): Promise<ValidationResult> {
    // Validate itemId is provided
    if (!input.itemId) {
      return this.validationError(
        'itemId is required for item use',
        'MISSING_ITEM_ID'
      );
    }

    // Validate item exists in database
    const Item = context.Item;
    const item = await Item.findById(input.itemId).lean();

    if (!item) {
      return this.validationError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }

    return this.validationSuccess();
  }

  async process(input: ActionInput, context: ActionContext): Promise<ActionData> {
    const actionData = this.buildBaseActionData(input);

    // Fetch item details from database
    const Item = context.Item;
    const item = await Item.findById(input.itemId).select('name description').lean();

    if (!item) {
      throw new Error('ITEM_NOT_FOUND'); // Should never happen (validated)
    }

    // Build itemEffect object
    actionData.itemEffect = {
      itemId: input.itemId!,
      itemName: item.name,
      description: `${input.characterName} usa ${item.name}`,
      consumedItems: [], // TODO: Implement consumption logic
      effects: [] // TODO: Implement effects logic
    };

    this.log('info', `Item used: ${item.name}`, {
      characterId: input.characterId,
      itemId: input.itemId,
      itemName: item.name
    });

    return actionData;
  }
}
