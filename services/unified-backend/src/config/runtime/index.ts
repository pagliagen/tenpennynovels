/**
 * Runtime Config - Unified exports
 *
 * Centralizes all runtime configuration:
 * - Database connection
 * - Redis connection
 * - Validation rules
 * - App configuration (cookie, CORS, URLs, features)
 */

export { DatabaseConnection, db } from './database';
export { RedisConnection, redis } from './redis';
export { validationConfig } from './validation';
export { appConfig } from './appConfig';
