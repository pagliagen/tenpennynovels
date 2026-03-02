/**
 * Test Controller - WebSocket Event Testing
 *
 * DEVELOPMENT ONLY - Endpoints for testing WebSocket event emission.
 *
 * @module modules/game/controllers/TestController
 * @since 2.0.0
 */

import { Request, Response } from 'express';
import { redis } from '@config/runtime/redis';
import { logger } from '../utils/logger';

export class TestController {
  /**
   * Emit test WebSocket event via Redis pub/sub
   *
   * POST /game/test/emit-event
   *
   * Body:
   * {
   *   "eventType": "player_entered",
   *   "channel": "location:location-id",
   *   "data": { ... }
   * }
   *
   * @example
   * curl -X POST http://localhost:8000/game/test/emit-event \
   *   -H "Content-Type: application/json" \
   *   -d '{
   *     "eventType": "player_entered",
   *     "channel": "location:test-location",
   *     "data": {
   *       "characterId": "123",
   *       "characterName": "Test Player",
   *       "locationId": "test-location"
   *     }
   *   }'
   */
  static async emitTestEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventType, channel, data } = req.body;

      if (!eventType || !channel || !data) {
        res.status(400).json({
          result: false,
          error: 'Missing required fields: eventType, channel, data',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      // Build event payload
      const event = {
        type: eventType,
        data: {
          ...data,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      };

      // Publish to Redis channel
      await redis.publish(channel, JSON.stringify(event));

      logger.info(`[TEST] Emitted WebSocket event: ${eventType} on channel ${channel}`, {
        eventType,
        channel,
        data,
      });

      res.json({
        result: true,
        data: {
          message: 'Test event emitted successfully',
          eventType,
          channel,
          event,
        },
      });
    } catch (error: any) {
      logger.error('[TEST] Failed to emit test event:', error);
      res.status(500).json({
        result: false,
        error: 'Failed to emit test event',
        code: 'INTERNAL_ERROR',
        details: error.message,
      });
    }
  }

  /**
   * Emit predefined test events (quick testing)
   *
   * POST /game/test/emit-quick/:type
   *
   * Types:
   * - player_entered
   * - location_message
   * - global_presence
   */
  static async emitQuickEvent(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as string;
      const userId = (req as any).user?.userId;
      const characterId = (req as any).character?.characterId;
      const characterName = (req as any).character?.characterName || 'Test Character';

      const events: Record<string, { eventType: string; channel: string; data: any }> = {
        player_entered: {
          eventType: 'player_entered_location', // Fixed: match LocationEventHandler
          channel: 'location:events',
          data: {
            userId: userId || 'test-user-id',
            characterId: characterId || 'test-char-id',
            characterName,
            locationId: 'test-location',
            timestamp: new Date().toISOString(),
          },
        },
        location_message: {
          eventType: 'location_chat_message', // Fixed: match LocationEventHandler
          channel: 'location:events',
          data: {
            messageId: 'test-msg-' + Date.now(),
            userId: userId || 'test-user-id',
            characterId: characterId || 'test-char-id',
            characterName,
            locationId: 'test-location',
            content: 'This is a test message from WebSocket test endpoint!',
            timestamp: new Date().toISOString(),
          },
        },
        global_presence: {
          eventType: 'globalPresence_update', // Global broadcast to ALL clients
          channel: 'location:events',
          data: {
            globalPresence: [
              {
                characterId: characterId || 'test-char-id',
                characterName: characterName || 'Test Character',
                status: 'online',
                locationId: 'test-location',
                locationName: 'Test Location',
              }
            ],
            timestamp: new Date().toISOString(),
          },
        },
        // NEW: Test global broadcast (player login/logout)
        player_login: {
          eventType: 'globalPresence_update', // Reuse global presence system
          channel: 'location:events',
          data: {
            globalPresence: [
              {
                characterId: characterId || 'test-char-id',
                characterName: characterName || 'Test Player',
                status: 'online',
                locationId: null,
                locationName: 'Just logged in!',
              }
            ],
            timestamp: new Date().toISOString(),
          },
        },
      };

      const eventConfig = events[type];
      if (!eventConfig) {
        res.status(400).json({
          result: false,
          error: `Unknown event type: ${type}`,
          code: 'INVALID_TYPE',
          availableTypes: Object.keys(events),
        });
        return;
      }

      // Build and publish event
      const event = {
        type: eventConfig.eventType,
        data: eventConfig.data,
      };

      await redis.publish(eventConfig.channel, JSON.stringify(event));

      logger.info(`[TEST] Emitted quick test event: ${type}`, { event });

      res.json({
        result: true,
        data: {
          message: `Quick test event '${type}' emitted successfully`,
          eventType: eventConfig.eventType,
          channel: eventConfig.channel,
          event,
        },
      });
    } catch (error: any) {
      logger.error('[TEST] Failed to emit quick test event:', error);
      res.status(500).json({
        result: false,
        error: 'Failed to emit quick test event',
        code: 'INTERNAL_ERROR',
        details: error.message,
      });
    }
  }
}
