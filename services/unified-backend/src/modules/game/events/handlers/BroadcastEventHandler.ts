import { IEventHandler, RedisEvent, EventHandlerContext } from '../types';
import { BroadcastMessage } from '@database/models/BroadcastMessage';
import { logger } from '@shared/utils/logger';

/**
 * BroadcastEventHandler
 *
 * Handles BROADCAST_MESSAGE_CREATED events from Redis pub/sub.
 * Fetches broadcast message from database, filters target audience,
 * and emits WebSocket events to appropriate clients.
 *
 * Supports role-based filtering (all, players, masters, admins, specific).
 */
export class BroadcastEventHandler implements IEventHandler {
  private context: EventHandlerContext;

  constructor(context: EventHandlerContext) {
    this.context = context;
  }

  getSupportedEventTypes(): string[] {
    return ['BROADCAST_MESSAGE_CREATED'];
  }

  async handle(event: RedisEvent): Promise<void> {
    if (event.type === 'BROADCAST_MESSAGE_CREATED') {
      await this.handleBroadcastCreated(event.data);
    }
  }

  private async handleBroadcastCreated(data: any): Promise<void> {
    const { broadcastId } = data;

    try {
      // Fetch full broadcast from DB
      const broadcast = await BroadcastMessage.findById(broadcastId);

      if (!broadcast) {
        logger.warn('Broadcast not found', { broadcastId });
        return;
      }

      // Check expiry
      if (broadcast.expiresAt && new Date(broadcast.expiresAt) < new Date()) {
        logger.debug('Broadcast expired, skipping delivery', { broadcastId });
        return;
      }

      // Prepare WebSocket payload
      const payload = {
        id: broadcast._id.toString(),
        message: {
          title: broadcast.title,
          content: broadcast.content
        },
        type: broadcast.priority || 'info', // 'emergency' | 'warning' | 'info'
        urgent: broadcast.priority === 'emergency',
        timestamp: Date.now()
      };

      // Target audience filtering
      if (broadcast.targetAudience === 'all' || broadcast.targetAudience === 'online') {
        // Broadcast to ALL connected sockets
        this.context.io.emit('broadcast:message', payload);

        logger.info('Broadcast sent to all sockets', {
          broadcastId,
          title: broadcast.title
        });

        // Update delivery stats
        const allSockets = await this.context.io.fetchSockets();
        await BroadcastMessage.findByIdAndUpdate(broadcastId, {
          $set: {
            'stats.deliveredCount': allSockets.length,
            'stats.lastDeliveredAt': new Date()
          }
        });
      } else {
        // Emit to filtered sockets individually
        const targetSockets = await this.filterSocketsByAudience(
          broadcast.targetAudience,
          broadcast.targetCharacterIds
        );

        for (const socket of targetSockets) {
          socket.emit('broadcast:message', payload);
        }

        logger.info('Broadcast sent to filtered sockets', {
          broadcastId,
          count: targetSockets.length,
          audience: broadcast.targetAudience
        });

        // Update delivery stats
        await BroadcastMessage.findByIdAndUpdate(broadcastId, {
          $set: {
            'stats.deliveredCount': targetSockets.length,
            'stats.lastDeliveredAt': new Date()
          }
        });
      }

    } catch (error: any) {
      logger.error('Broadcast delivery failed', {
        error: error.message,
        broadcastId
      });
    }
  }

  /**
   * Filter sockets by target audience
   *
   * @param audience - Target audience type
   * @param targetCharacterIds - Optional specific character IDs
   * @returns Array of filtered Socket instances
   */
  private async filterSocketsByAudience(
    audience: string,
    targetCharacterIds?: string[]
  ): Promise<any[]> {
    const sockets = await this.context.io.fetchSockets();

    if (audience === 'all' || audience === 'online') {
      return sockets;
    }

    if (audience === 'specific' && targetCharacterIds) {
      return sockets.filter(socket =>
        targetCharacterIds.includes(socket.data.character?.characterId)
      );
    }

    // Role-based filtering
    if (audience === 'players' || audience === 'masters' || audience === 'admins') {
      return sockets.filter(socket => {
        const roles = socket.data.character?.gameplayRoles || [];

        if (audience === 'players') return roles.includes('player');
        if (audience === 'masters') return roles.includes('master');
        if (audience === 'admins') return socket.data.user?.canAccessAdminPanel;

        return false;
      });
    }

    return [];
  }
}
