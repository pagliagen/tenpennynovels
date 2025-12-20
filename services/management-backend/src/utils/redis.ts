import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

class RedisService {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private publisher: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({ url: redisUrl });
    this.subscriber = createClient({ url: redisUrl });
    this.publisher = createClient({ url: redisUrl });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', { error: error instanceof Error ? error.message : String(error) });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client connection ended');
      this.isConnected = false;
    });

    // Subscriber events
    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', { error: error instanceof Error ? error.message : String(error) });
    });

    // Publisher events
    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error:', { error: error instanceof Error ? error.message : String(error) });
    });
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
      
      logger.info('All Redis clients connected successfully');
    } catch (error: any) {
      logger.error('Failed to connect to Redis:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.quit(),
        this.subscriber.quit(),
        this.publisher.quit()
      ]);
      
      logger.info('All Redis clients disconnected');
    } catch (error: any) {
      logger.error('Error disconnecting from Redis:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Publish management events to Redis
  async publishManagementEvent(channel: string, data: any): Promise<void> {
    try {
      if (!this.isConnected) {
        logger.warn('Redis not connected, skipping event publication');
        return;
      }

      const payload = {
        ...data,
        source: 'management-backend',
        timestamp: new Date().toISOString()
      };

      await this.publisher.publish(channel, JSON.stringify(payload));
      
      logger.info('Management event published', {
        channel,
        eventType: data.eventType || 'unknown',
        dataKeys: Object.keys(data)
      });
    } catch (error: any) {
      logger.error('Failed to publish management event:', {
        error: error instanceof Error ? error.message : String(error),
        channel,
        data: data
      });
    }
  }

  // Subscribe to events (for future use)
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel, callback);
      logger.info('Subscribed to Redis channel', { channel });
    } catch (error: any) {
      logger.error('Failed to subscribe to Redis channel:', {
        error: error instanceof Error ? error.message : String(error),
        channel
      });
    }
  }

  // Management-specific event publishers
  async publishCharacterEvent(eventType: string, data: any): Promise<void> {
    await this.publishManagementEvent('admin:character_events', {
      eventType,
      ...data
    });
  }

  async publishUserEvent(eventType: string, data: any): Promise<void> {
    await this.publishManagementEvent('admin:user_events', {
      eventType,
      ...data
    });
  }

  async publishLocationEvent(eventType: string, data: any): Promise<void> {
    await this.publishManagementEvent('admin:location_events', {
      eventType,
      ...data
    });
  }

  async publishEconomyEvent(eventType: string, data: any): Promise<void> {
    await this.publishManagementEvent('admin:economy_events', {
      eventType,
      ...data
    });
  }

  async publishSystemEvent(eventType: string, data: any): Promise<void> {
    await this.publishManagementEvent('admin:system_events', {
      eventType,
      ...data
    });
  }

  // Ticket management events
  async publishTicketEvent(eventType: string, data: any): Promise<void> {
    await this.publishManagementEvent('admin:ticket_events', {
      eventType,
      ...data
    });
  }

  // Audit log events
  async publishAuditEvent(auditData: any): Promise<void> {
    await this.publishManagementEvent('admin:audit_events', {
      eventType: 'audit_log_created',
      ...auditData
    });
  }

  // Cache management (for future use)
  async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    try {
      if (expireInSeconds) {
        await this.client.setEx(key, expireInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error: any) {
      logger.error('Redis SET error:', { error: error instanceof Error ? error.message : String(error), key });
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error: any) {
      logger.error('Redis GET error:', { error: error instanceof Error ? error.message : String(error), key });
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error: any) {
      logger.error('Redis DEL error:', { error: error instanceof Error ? error.message : String(error), key });
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch (error: any) {
      logger.error('Redis PING error:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // Get connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Create singleton instance
const redisService = new RedisService();

export { redisService };
export default redisService;