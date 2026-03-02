/**
 * Character Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Handles all character-related events:
 * - Character creation
 * - Character approval/rejection
 * - Character stats changes
 * - Character review notifications
 */

import { BaseEventHandler } from '../BaseEventHandler';
import { RedisEvent } from '../types';
import { logger } from '../../utils/logger';

export class CharacterEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return [
      'character_created',
      'character_approved',
      'character_rejected',
      'character_stats_changed'
    ];
  }

  async handle(event: RedisEvent): Promise<void> {
    this.logEventHandling(event.type, event);

    switch (event.type) {
      case 'character_created':
        await this.handleCharacterCreated(event);
        break;

      case 'character_approved':
        await this.handleCharacterApproved(event);
        break;

      case 'character_rejected':
        await this.handleCharacterRejected(event);
        break;

      case 'character_stats_changed':
        await this.handleCharacterStatsChanged(event);
        break;

      default:
        logger.debug(`[CharacterEventHandler] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle character creation event
   * Notifies staff about new character pending approval
   */
  private async handleCharacterCreated(event: any): Promise<void> {
    this.io.to('staff').emit('character_pending_approval', {
      characterId: event.characterId,
      characterName: event.characterName,
      userId: event.userId,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle character approval event
   * Notifies character owner about approval
   */
  private async handleCharacterApproved(event: any): Promise<void> {
    this.io.to(`user_${event.userId}`).emit('character_approved', {
      characterId: event.characterId,
      characterName: event.characterName,
      approvedBy: event.approvedBy,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle character rejection event
   * Notifies character owner about rejection
   */
  private async handleCharacterRejected(event: any): Promise<void> {
    this.io.to(`user_${event.userId}`).emit('character_rejected', {
      characterId: event.characterId,
      characterName: event.characterName,
      reason: event.reason,
      rejectedBy: event.rejectedBy,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle character stats changed event
   * Triggers corporation membership checks
   */
  private async handleCharacterStatsChanged(event: any): Promise<void> {
    // Publish event to corporation channel to check automatic memberships
    // Note: This requires access to RedisPublisher, which should be injected
    logger.debug('[CharacterEventHandler] Character stats changed - corporation checks needed', {
      characterId: event.characterId
    });

    // TODO: Inject RedisPublisher to publish this event
    // await this.publisher.publish('corporation:events', JSON.stringify({
    //   type: 'check_automatic_memberships',
    //   characterId: event.characterId,
    //   triggeredBy: 'stats_change',
    //   timestamp: new Date().toISOString(),
    //   source: 'game-backend'
    // }));
  }
}
