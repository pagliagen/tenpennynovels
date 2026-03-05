/**
 * Redis Connection Utility for Seeders
 *
 * Singleton pattern for managing Redis publisher connection
 * Used for publishing embedding events to workers
 *
 * Pattern source: unified-backend/src/config/runtime/redis.ts (simplified)
 */

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

export class RedisSeederConnection {
  private static instance: RedisSeederConnection;
  private publisherClient!: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): RedisSeederConnection {
    if (!RedisSeederConnection.instance) {
      RedisSeederConnection.instance = new RedisSeederConnection();
    }
    return RedisSeederConnection.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('[Redis] Already connected');
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.publisherClient = createClient({ url: redisUrl });

      this.publisherClient.on('error', (err) => {
        console.error('[Redis] Error:', err);
      });

      this.publisherClient.on('ready', () => {
        console.log('[Redis] ✅ Publisher client ready');
      });

      this.publisherClient.on('end', () => {
        console.log('[Redis] Connection closed');
      });

      await this.publisherClient.connect();
      this.isConnected = true;
      console.log('[Redis] ✅ Connected successfully');
    } catch (error) {
      console.error('[Redis] ❌ Connection failed:', error);
      throw error;
    }
  }

  getPublisher(): RedisClientType {
    if (!this.isConnected) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.publisherClient;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.publisherClient.quit();
      this.isConnected = false;
      console.log('[Redis] Disconnected');
    } catch (error) {
      console.error('[Redis] Error disconnecting:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.publisherClient.isReady;
  }
}

export const redisSeeder = RedisSeederConnection.getInstance();
