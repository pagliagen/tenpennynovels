/**
 * Configuration Service
 *
 * Manages system configurations with Redis caching support.
 * Used to fetch email templates and system constants from the database.
 *
 * Features:
 * - Redis caching with configurable TTL (default 1 hour)
 * - Event-driven cache invalidation via Redis pub/sub
 * - Section-based configuration retrieval
 * - Fallback to defaultValue on config not found
 * - Audit trail for configuration updates
 *
 * Usage:
 * ```typescript
 * import { ConfigurationService } from '@tenpennynovels/shared';
 * import { redisClient } from './config/redis';
 * import { logger } from './utils/logger';
 *
 * const configService = new ConfigurationService(redisClient, logger);
 *
 * // Get single configuration
 * const template = await configService.getConfig('email_template_verification');
 *
 * // Get all configurations by section
 * const characterConfigs = await configService.getConfigsBySection('character_creation');
 * ```
 */

import type { RedisClientType } from 'redis';
import type { ISystemConfiguration } from '@database/models';

const CACHE_PREFIX = 'system_config:';
const CACHE_TTL = 3600; // 1 hour in seconds

interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export class ConfigurationService {
  private redis: RedisClientType;
  private logger: Logger;

  /**
   * Initialize the Configuration Service
   *
   * @param redis - Redis client instance for caching
   * @param logger - Logger instance (winston or compatible)
   */
  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Get configuration value with caching
   *
   * @param configKey - Unique configuration key (e.g., 'email_template_verification')
   * @returns Configuration value or null if not found
   *
   * @example
   * ```typescript
   * const template = await configService.getConfig('email_template_verification');
   * if (template) {
   *   const html = this.replacePlaceholders(template.html, { displayName: 'John', verificationUrl: 'https://...' });
   * }
   * ```
   */
  async getConfig(configKey: string): Promise<any> {
    try {
      // Try cache first
      const cacheKey = `${CACHE_PREFIX}${configKey}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.info(`Configuration cache hit: ${configKey}`);
        return JSON.parse(cached);
      }

      this.logger.info(`Configuration cache miss: ${configKey}, fetching from database`);

      // Fetch from database - dynamic import to ensure model is loaded
      const { SystemConfiguration } = await import('@database/models');
      const config = await SystemConfiguration.findOne({
        configKey,
        isActive: true,
      }).lean();

      if (!config) {
        this.logger.warn(`Configuration not found: ${configKey}`);
        return null;
      }

      const value = config.value || config.defaultValue;

      // Cache for future requests
      await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(value));

      this.logger.info(`Configuration fetched and cached: ${configKey}`);
      return value;
    } catch (error) {
      this.logger.error(`Error getting config ${configKey}:`, error);
      throw error;
    }
  }

  /**
   * Get all configurations by section
   *
   * @param section - Configuration section (e.g., 'email_templates', 'character_creation')
   * @returns Object with configKey as key and value as value
   *
   * @example
   * ```typescript
   * const characterConfigs = await configService.getConfigsBySection('character_creation');
   * // Result: { character_stat_total_points: 400, character_max_stats_above_80: 2, ... }
   * ```
   */
  async getConfigsBySection(section: string): Promise<Record<string, any>> {
    try {
      this.logger.info(`Fetching configurations for section: ${section}`);

      // Fetch from database - dynamic import to ensure model is loaded
      const { SystemConfiguration } = await import('@database/models');
      const configs = await SystemConfiguration.find({
        configSection: section,
        isActive: true,
      }).lean();

      const result: Record<string, any> = {};
      for (const config of configs) {
        result[config.configKey] = config.value || config.defaultValue;
      }

      this.logger.info(`Fetched ${configs.length} configurations for section: ${section}`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting configs for section ${section}:`, error);
      throw error;
    }
  }

  /**
   * Update configuration value with audit trail
   *
   * @param configKey - Configuration key to update
   * @param newValue - New value (can be any type: template object, number, string, boolean, JSON)
   * @param updatedBy - User ID who is making the update
   * @param updateReason - Optional reason for the update (for audit trail)
   * @returns Updated configuration document or null if not found
   *
   * @example
   * ```typescript
   * await configService.updateConfig(
   *   'character_stat_total_points',
   *   450,
   *   userId,
   *   'Increased for gameplay balance'
   * );
   * ```
   */
  async updateConfig(
    configKey: string,
    newValue: any,
    updatedBy: string,
    updateReason?: string
  ): Promise<ISystemConfiguration | null> {
    try {
      this.logger.info(`Updating configuration: ${configKey} by ${updatedBy}`);

      // Fetch from database - dynamic import to ensure model is loaded
      const { SystemConfiguration } = await import('@database/models');
      const config = await SystemConfiguration.findOneAndUpdate(
        { configKey },
        {
          $set: {
            value: newValue,
            'metadata.lastUpdatedBy': updatedBy,
            'metadata.lastUpdatedAt': new Date(),
            'metadata.updateReason': updateReason,
          },
          $inc: { 'metadata.version': 1 },
        },
        { returnDocument: 'after' }
      );

      if (config) {
        // Invalidate cache
        const cacheKey = `${CACHE_PREFIX}${configKey}`;
        await this.redis.del(cacheKey);

        // Publish event for other services to invalidate their caches
        await this.redis.publish(
          'system_config_updated',
          JSON.stringify({
            configKey,
            newValue,
            updatedBy,
            timestamp: new Date().toISOString(),
          })
        );

        this.logger.info(`Configuration updated successfully: ${configKey} (version ${config.metadata.version})`);
      } else {
        this.logger.warn(`Configuration not found for update: ${configKey}`);
      }

      return config;
    } catch (error) {
      this.logger.error(`Error updating config ${configKey}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate all cached configurations
   *
   * Useful when you want to force a fresh fetch from database for all configs.
   * This is typically called after bulk configuration updates or system maintenance.
   *
   * @example
   * ```typescript
   * await configService.invalidateAllCache();
   * ```
   */
  async invalidateAllCache(): Promise<void> {
    try {
      this.logger.info('Invalidating all configuration cache entries');

      const keys = await this.redis.keys(`${CACHE_PREFIX}*`);

      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.info(`Invalidated ${keys.length} cached configurations`);
      } else {
        this.logger.info('No cached configurations to invalidate');
      }

      // Publish event to notify other services
      await this.redis.publish(
        'system_config_cache_invalidated',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          keysCleared: keys.length,
        })
      );
    } catch (error) {
      this.logger.error('Error invalidating cache:', error);
      throw error;
    }
  }

  /**
   * Subscribe to configuration update events
   *
   * Listen to Redis pub/sub events for configuration updates from other services.
   * Automatically invalidates local cache when configurations are updated elsewhere.
   *
   * @example
   * ```typescript
   * configService.subscribeToUpdates();
   * ```
   */
  async subscribeToUpdates(): Promise<void> {
    try {
      // Create a separate Redis client for pub/sub (required by ioredis)
      const subscriber = this.redis.duplicate();

      // Subscribe with callbacks (node-redis pattern)
      await subscriber.subscribe('system_config_updated', async (message) => {
        try {
          const data = JSON.parse(message);
          const { configKey } = data;
          const cacheKey = `${CACHE_PREFIX}${configKey}`;
          await this.redis.del(cacheKey);
          this.logger.info(`Cache invalidated for updated config: ${configKey}`);
        } catch (error) {
          this.logger.error('Error processing system_config_updated event:', error);
        }
      });

      await subscriber.subscribe('system_config_cache_invalidated', async (message) => {
        try {
          // Another service invalidated all cache
          this.logger.info('Received cache invalidation event from another service');
          // Local cache already cleared by the service that sent the event
        } catch (error) {
          this.logger.error('Error processing system_config_cache_invalidated event:', error);
        }
      });

      this.logger.info('Subscribed to configuration update events');
    } catch (error) {
      this.logger.error('Error subscribing to configuration updates:', error);
      throw error;
    }
  }
}
