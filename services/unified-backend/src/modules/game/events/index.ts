/**
 * Event Handling System - Main Exports
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Centralized exports for the refactored event handling system.
 */

export * from './types';
export * from './BaseEventHandler';
export * from './EventRouter';
export * from './RedisSubscriber';

// Export individual handlers for testing/direct access
export { CharacterEventHandler } from './handlers/CharacterEventHandler';
export { CharacterReviewEventHandler } from './handlers/CharacterReviewEventHandler';
export { LocationEventHandler } from './handlers/LocationEventHandler';
export { UserEventHandler } from './handlers/UserEventHandler';
export { GameEventHandler } from './handlers/GameEventHandler';
export { TicketEventHandler } from './handlers/TicketEventHandler';
