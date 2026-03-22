/**
 * User Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Handles all user-related events:
 * - User login/logout
 * - Character selection
 */

import { BaseEventHandler } from '../BaseEventHandler';
import type { RedisEvent } from '../types';
import { logger } from '../../logger';

export class UserEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return [
      'user_login',
      'user_logout',
      'user_character_selected',
      'character_ban_updated',
    ];
  }

  async handle(event: RedisEvent): Promise<void> {
    this.logEventHandling(event.type, event);

    switch (event.type) {
      case 'user_login':
        await this.handleUserLogin(event);
        break;

      case 'user_logout':
        await this.handleUserLogout(event);
        break;

      case 'user_character_selected':
        await this.handleCharacterSelection(event);
        break;

      case 'character_ban_updated':
        await this.handleCharacterBanUpdated(event as RedisEvent & {
          userId: string;
          characterId: string;
          banScope: string | null;
          active: boolean;
        });
        break;

      default:
        logger.debug(`[UserEventHandler] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle user login
   * Notifies about user coming online
   */
  private async handleUserLogin(event: any): Promise<void> {
    this.io.emit('user_status_change', {
      userId: event.userId,
      username: event.username,
      status: 'online',
      timestamp: event.timestamp
    });
  }

  /**
   * Handle user logout
   * Notifies about user going offline and character deactivation
   */
  private async handleUserLogout(event: any): Promise<void> {
    // Emit user-level status change
    this.io.emit('user_status_change', {
      userId: event.userId,
      username: event.username,
      status: 'offline',
      timestamp: event.timestamp || new Date().toISOString()
    });

    // Emit character-level inactive event if character was active
    if (event.characterId) {
      this.io.emit('character_inactive', {
        userId: event.userId,
        characterId: event.characterId,
        characterName: event.characterName,
        status: 'offline',
        timestamp: event.timestamp || new Date().toISOString()
      });
    }
  }

  /**
   * Handle character selection
   * Notifies about character becoming active
   */
  private async handleCharacterSelection(event: any): Promise<void> {
    this.io.emit('character_active', {
      userId: event.userId,
      characterId: event.characterId,
      characterName: event.characterName,
      timestamp: event.timestamp
    });
  }

  /**
   * Ban / unban sul personaggio: tutte le tab dello stesso utente (room user_${id}).
   */
  private async handleCharacterBanUpdated(event: {
    userId: string;
    characterId: string;
    banScope: string | null;
    active: boolean;
    timestamp?: string;
  }): Promise<void> {
    if (!event.userId) return;
    this.io.to(`user_${event.userId}`).emit('character_ban_updated', {
      userId: event.userId,
      characterId: event.characterId,
      banScope: event.banScope,
      active: event.active,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }
}
