/**
 * Item Use Enricher
 *
 * Enriches item_use actions with full item details.
 * Fetches Item document from MessageContext (cached).
 *
 * Before: { itemEffect: { itemId: '123', ... } }
 * After:  { itemEffect: { itemId: '123', itemName: 'Healing Potion', itemDescription: '...', ... } }
 *
 * @module transformers/enrichers/ItemUseEnricher
 * @since 2.2.0
 */

import type { IMessageEnricher } from '@modules/game/transformers/enrichers/IMessageEnricher';
import type { EnrichedChatMessage, EnrichedItemEffect } from '@modules/game/transformers/types';
import type { MessageContext } from '@modules/game/transformers/MessageContext';
import { logger } from '@shared/utils/logger';

/**
 * Enricher for item use actions
 */
export class ItemUseEnricher implements IMessageEnricher {
  canEnrich(actionType: string): boolean {
    return actionType === 'item_use';
  }

  async enrich(action: any, context: MessageContext): Promise<Partial<EnrichedChatMessage>> {
    // Check if action has item data to enrich
    if (!action.itemEffect?.itemId) {
      logger.debug('[ItemUseEnricher] No itemId found, skipping enrichment');
      return {};
    }

    // Get item from context (cached)
    const item = await context.getItem(action.itemEffect.itemId);
    if (!item) {
      logger.warn(`[ItemUseEnricher] Item not found: ${action.itemEffect.itemId}`);
      return {};
    }

    // Build enriched item effect
    const enrichedItemEffect: EnrichedItemEffect = {
      itemId: action.itemEffect.itemId,
      itemName: item.name, // ← ENRICHED from Item document
      itemDescription: item.description, // ← ENRICHED
      itemImageUrl: item.imageUrl, // ← ENRICHED
      description: action.itemEffect.description || `${action.characterName} uses ${item.name}`,
      consumedItems: action.itemEffect.consumedItems || [],
      effects: action.itemEffect.effects || [],
    };

    // Enrich consumed items names (if any)
    if (enrichedItemEffect.consumedItems && enrichedItemEffect.consumedItems.length > 0) {
      for (const consumed of enrichedItemEffect.consumedItems) {
        if (consumed.itemId && !consumed.itemName) {
          const consumedItem = await context.getItem(consumed.itemId);
          if (consumedItem) {
            consumed.itemName = consumedItem.name;
          }
        }
      }
    }

    logger.debug(`[ItemUseEnricher] Enriched item: ${item.name}`);

    return { itemEffect: enrichedItemEffect };
  }
}
