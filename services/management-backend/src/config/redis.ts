import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;
let redisSubscriber: RedisClientType;
let redisPublisher: RedisClientType;

export async function connectRedis(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Main Redis client
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    redisClient.on('connect', () => logger.info('Redis Client connected'));
    redisClient.on('disconnect', () => logger.warn('Redis Client disconnected'));
    await redisClient.connect();
    
    // Subscriber client (for pub/sub)
    redisSubscriber = createClient({ url: redisUrl });
    redisSubscriber.on('error', (err) => logger.error('Redis Subscriber Error:', err));
    redisSubscriber.on('connect', () => logger.info('Redis Subscriber connected'));
    await redisSubscriber.connect();
    
    // Publisher client (for pub/sub)
    redisPublisher = createClient({ url: redisUrl });
    redisPublisher.on('error', (err) => logger.error('Redis Publisher Error:', err));
    redisPublisher.on('connect', () => logger.info('Redis Publisher connected'));
    await redisPublisher.connect();
    
    logger.info('Connected to Redis successfully');
    
  } catch (error: any) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.disconnect();
    }
    if (redisSubscriber) {
      await redisSubscriber.disconnect();
    }
    if (redisPublisher) {
      await redisPublisher.disconnect();
    }
    logger.info('Disconnected from Redis');
  } catch (error: any) {
    logger.error('Error disconnecting from Redis:', error);
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export function getRedisSubscriber(): RedisClientType {
  if (!redisSubscriber) {
    throw new Error('Redis subscriber not initialized. Call connectRedis() first.');
  }
  return redisSubscriber;
}

export function getRedisPublisher(): RedisClientType {
  if (!redisPublisher) {
    throw new Error('Redis publisher not initialized. Call connectRedis() first.');
  }
  return redisPublisher;
}