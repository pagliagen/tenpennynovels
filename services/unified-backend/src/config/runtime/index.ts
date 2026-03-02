/**
 * Runtime Config - Unified exports
 *
 * Centralizes all runtime configuration:
 * - Database connection
 * - Redis connection
 * - Validation rules
 */

export { DatabaseConnection, db } from './database';
export { RedisConnection, redis } from './redis';
export { validationConfig } from './validation';
