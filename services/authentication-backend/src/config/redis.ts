import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClientType | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      logger.info('Redis already connected');
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 100, 5000)
        }
      });

      // Handle connection events
      this.client.on('error', (error) => {
        logger.error('Redis connection error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      });

      await this.client.connect();
      logger.info('Connected to Redis successfully');

    } catch (error: any) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    } catch (error: any) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  isConnectionHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      if (!this.client || !this.isConnected) {
        return { status: 'unhealthy', details: { error: 'Not connected to Redis' } };
      }

      // Simple ping to check if Redis is responsive
      const pong = await this.client.ping();
      
      return {
        status: 'healthy',
        details: {
          ping: pong,
          connected: this.isConnected,
          url: process.env.REDIS_URL || 'redis://localhost:6379'
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          connected: this.isConnected
        }
      };
    }
  }

  // Event publishing methods
  async publish(channel: string, message: any): Promise<void> {
    try {
      const client = this.getClient();
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      await client.publish(channel, messageStr);
      logger.debug(`Published message to channel ${channel}:`, message);
    } catch (error: any) {
      logger.error(`Failed to publish message to channel ${channel}:`, error);
      throw error;
    }
  }

  // Session management
  async setSession(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<void> {
    try {
      const client = this.getClient();
      const sessionData = JSON.stringify(data);
      await client.setEx(`session:${sessionId}`, ttlSeconds, sessionData);
    } catch (error: any) {
      logger.error(`Failed to set session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const client = this.getClient();
      const sessionData = await client.get(`session:${sessionId}`);
      return sessionData ? JSON.parse(sessionData as string) : null;
    } catch (error: any) {
      logger.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const client = this.getClient();
      await client.del(`session:${sessionId}`);
    } catch (error: any) {
      logger.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }

  // Rate limiting
  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    try {
      const client = this.getClient();
      const multi = client.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      const results = await multi.exec();
      return (results?.[0] as unknown as number) || 0;
    } catch (error: any) {
      logger.error(`Failed to increment rate limit ${key}:`, error);
      throw error;
    }
  }

  async getRateLimit(key: string): Promise<number> {
    try {
      const client = this.getClient();
      const count = await client.get(key);
      return count ? parseInt(count as string, 10) : 0;
    } catch (error: any) {
      logger.error(`Failed to get rate limit ${key}:`, error);
      return 0;
    }
  }
}

export const redis = RedisConnection.getInstance();