import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { logger } from '@shared/utils/logger';

/**
 * Singleton RedisConnection - Unified config for all modules
 *
 * Replaces:
 * - modules/auth/config/redis.ts (1 client, session/rate-limiting/cache)
 * - modules/game/config/redis.ts (3 clients for pub/sub)
 * - modules/admin/config/redis.ts (3 clients for pub/sub)
 *
 * Pattern: Class-based Singleton with 3 clients (main, subscriber, publisher)
 * Features: Session management, rate limiting, cache operations, pub/sub
 */
export class RedisConnection {
  private static instance: RedisConnection;

  private mainClient!: RedisClientType;
  private subscriberClient!: RedisClientType;
  private publisherClient!: RedisClientType;

  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Redis already connected');
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      // Create 3 clients for pub/sub pattern
      this.mainClient = createClient({ url: redisUrl });
      this.subscriberClient = createClient({ url: redisUrl });
      this.publisherClient = createClient({ url: redisUrl });

      // Reconnection strategy and event handlers
      [this.mainClient, this.subscriberClient, this.publisherClient].forEach((client, index) => {
        const clientName = ['main', 'subscriber', 'publisher'][index];

        client.on('error', (err) => {
          logger.error(`Redis ${clientName} error:`, err);
        });

        client.on('reconnecting', () => {
          logger.warn(`Redis ${clientName} reconnecting...`);
        });

        client.on('ready', () => {
          logger.info(`✅ Redis ${clientName} client ready`);
        });

        client.on('end', () => {
          logger.info(`Redis ${clientName} connection closed`);
        });
      });

      // Connect all clients
      await Promise.all([
        this.mainClient.connect(),
        this.subscriberClient.connect(),
        this.publisherClient.connect(),
      ]);

      this.isConnected = true;
      logger.info('✅ Redis connected successfully (3 clients: main, subscriber, publisher)');
    } catch (error) {
      logger.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  // Client accessors
  getClient(): RedisClientType {
    return this.mainClient;
  }

  getSubscriber(): RedisClientType {
    return this.subscriberClient;
  }

  getPublisher(): RedisClientType {
    return this.publisherClient;
  }

  // Session management (for auth module)
  async setSession(userId: string, data: any, ttl: number = 86400): Promise<void> {
    await this.mainClient.setEx(`session:${userId}`, ttl, JSON.stringify(data));
  }

  async getSession(userId: string): Promise<any | null> {
    const data = await this.mainClient.get(`session:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(userId: string): Promise<void> {
    await this.mainClient.del(`session:${userId}`);
  }

  // Rate limiting (for auth module)
  async incrementRateLimit(key: string, ttl: number = 60): Promise<number> {
    const count = await this.mainClient.incr(`ratelimit:${key}`);
    if (count === 1) {
      await this.mainClient.expire(`ratelimit:${key}`, ttl);
    }
    return count;
  }

  async getRateLimit(key: string): Promise<number> {
    const value = await this.mainClient.get(`ratelimit:${key}`);
    return value ? parseInt(value, 10) : 0;
  }

  async resetRateLimit(key: string): Promise<void> {
    await this.mainClient.del(`ratelimit:${key}`);
  }

  // Cache operations (for all modules)
  async get(key: string): Promise<string | null> {
    return await this.mainClient.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.mainClient.setEx(key, ttl, value);
    } else {
      await this.mainClient.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.mainClient.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.mainClient.exists(key);
    return result === 1;
  }

  // Hash operations
  async hSet(key: string, field: string, value: string): Promise<void> {
    await this.mainClient.hSet(key, field, value);
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return await this.mainClient.hGet(key, field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return await this.mainClient.hGetAll(key);
  }

  async hDel(key: string, field: string): Promise<void> {
    await this.mainClient.hDel(key, field);
  }

  // Event publishing (for game/admin modules)
  async publish(channel: string, message: string): Promise<number> {
    return await this.publisherClient.publish(channel, message);
  }

  // Disconnect
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('Redis already disconnected');
      return;
    }

    try {
      await Promise.all([
        this.mainClient.quit(),
        this.subscriberClient.quit(),
        this.publisherClient.quit(),
      ]);

      this.isConnected = false;
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
      throw error;
    }
  }

  // Health check
  isHealthy(): boolean {
    return this.isConnected && this.mainClient.isReady;
  }
}

// Export singleton instance for convenience
export const redis = RedisConnection.getInstance();
