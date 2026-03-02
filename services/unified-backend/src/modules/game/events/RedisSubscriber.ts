/**
 * Redis Subscriber
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Manages Redis channel subscriptions and delegates event handling to EventRouter.
 * Centralizes subscription logic and error handling.
 */

import { Server as SocketIOServer } from 'socket.io';
import { redis } from '@config/runtime/redis';
import { logger } from '../utils/logger';
import { EventRouter } from './EventRouter';
import { RedisChannel, RedisEvent } from './types';

export class RedisSubscriber {
  private subscriber = redis.getSubscriber();
  private publisher = redis.getPublisher();
  private router: EventRouter;

  constructor(io: SocketIOServer) {
    this.router = new EventRouter(io);
  }

  /**
   * Initialize Redis subscriptions for all channels
   */
  async initialize(): Promise<void> {
    try {
      // Subscribe to all Redis channels
      await this.subscribeToChannel(RedisChannel.USER_EVENTS);
      await this.subscribeToChannel(RedisChannel.CHARACTER_EVENTS);
      await this.subscribeToChannel(RedisChannel.CHARACTER_REVIEW);
      await this.subscribeToChannel(RedisChannel.GAME_EVENTS);
      await this.subscribeToChannel(RedisChannel.WEATHER_CHANGED);
      await this.subscribeToChannel(RedisChannel.LOCATION_EVENTS);
      await this.subscribeToChannel(RedisChannel.CORPORATION_EVENTS);
      await this.subscribeToChannel(RedisChannel.RELATIONSHIP_EVENTS);
      await this.subscribeToChannel(RedisChannel.TICKET_EVENTS);

      logger.info('✅ Redis Subscriber initialized and subscribed to all channels');
    } catch (error: any) {
      logger.error('❌ Failed to initialize Redis Subscriber:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a Redis channel with error handling
   */
  private async subscribeToChannel(channel: RedisChannel): Promise<void> {
    try {
      await this.subscriber.subscribe(channel, (message) => {
        this.handleMessage(channel, message);
      });

      logger.debug(`[RedisSubscriber] Subscribed to channel: ${channel}`);
    } catch (error: any) {
      logger.error(`[RedisSubscriber] Failed to subscribe to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming Redis message
   */
  private handleMessage(channel: RedisChannel, message: string): void {
    try {
      // Validate message format
      if (typeof message !== 'string' || !message.trim()) {
        logger.warn('[RedisSubscriber] Invalid message format', {
          channel,
          messageType: typeof message,
          messageLength: message?.length
        });
        return;
      }

      // Parse JSON message
      let event: RedisEvent;
      try {
        event = JSON.parse(message);
      } catch (jsonError) {
        logger.error('[RedisSubscriber] Invalid JSON in message', {
          channel,
          error: jsonError instanceof Error ? jsonError.message : String(jsonError),
          messagePreview: message.substring(0, 200)
        });
        return;
      }

      logger.debug(`[RedisSubscriber] Received event from ${channel}`, {
        eventType: event.type,
        timestamp: event.timestamp
      });

      // Route event to appropriate handler
      this.router.routeEvent(channel, event);

    } catch (error: any) {
      logger.error(`[RedisSubscriber] Error processing message from ${channel}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
      });
    }
  }

  /**
   * Publish an event to Redis
   */
  async publishEvent(channel: string, event: any): Promise<void> {
    try {
      const eventData = {
        ...event,
        timestamp: new Date().toISOString(),
        source: 'game-backend'
      };

      await this.publisher.publish(channel, JSON.stringify(eventData));
      logger.debug(`[RedisSubscriber] Published event to ${channel}`, eventData);
    } catch (error: any) {
      logger.error(`[RedisSubscriber] Failed to publish event to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown subscriber
   */
  async shutdown(): Promise<void> {
    try {
      await this.subscriber.quit();
      logger.info('[RedisSubscriber] Gracefully shut down');
    } catch (error: any) {
      logger.error('[RedisSubscriber] Error during shutdown:', error);
    }
  }
}
