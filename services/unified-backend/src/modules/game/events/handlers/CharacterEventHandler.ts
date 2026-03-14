/**
 * Character Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Handles character-related events:
 * - Character creation (notifies staff)
 * - Character stats changes (corporation checks)
 *
 * Note: Approval/rejection is handled by CharacterReviewEventHandler
 * via the character:review_completed Redis channel.
 */

import { BaseEventHandler } from '../BaseEventHandler';
import { RedisEvent } from '../types';
import { logger } from '../../logger';

export class CharacterEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return [
      'character_created',
      'character_stats_changed'
    ];
  }

  async handle(event: RedisEvent): Promise<void> {
    this.logEventHandling(event.type, event);

    switch (event.type) {
      case 'character_created':
        await this.handleCharacterCreated(event);
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
      username: event.username || '',
      timestamp: event.timestamp
    });
  }

  /**
   * Handle character stats changed event
   * Triggers corporation membership checks
   */
  private async handleCharacterStatsChanged(event: any): Promise<void> {
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
