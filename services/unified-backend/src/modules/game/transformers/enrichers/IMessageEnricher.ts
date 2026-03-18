/**
 * Message Enricher Interface
 *
 * Defines contract for type-specific message enrichers.
 * Each enricher knows how to add type-specific data to chat messages.
 *
 * @module transformers/enrichers/IMessageEnricher
 * @since 2.2.0
 */

import type { EnrichedChatMessage } from '../types';
import type { MessageContext } from '../MessageContext';

/**
 * Interface for type-specific message enrichers
 */
export interface IMessageEnricher {
  /**
   * Check if this enricher handles this action type
   *
   * @param actionType - Action type from chat message
   * @returns true if this enricher should process this type
   */
  canEnrich(actionType: string): boolean;

  /**
   * Enrich message with type-specific data
   *
   * Returns partial object to merge into EnrichedChatMessage.
   * Uses context to fetch related data (skills, items, etc.) with caching.
   *
   * @param action - Raw chat action from MongoDB
   * @param context - Request-scoped cache for related data
   * @returns Partial enriched data to merge into message
   */
  enrich(action: any, context: MessageContext): Promise<Partial<EnrichedChatMessage>>;
}
