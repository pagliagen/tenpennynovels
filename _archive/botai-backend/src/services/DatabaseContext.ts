import { Connection, Model, Schema } from 'mongoose';
import { db } from '../config/database';
import { ModelFactory } from '../models/ModelFactory';
import { logger } from '../utils/logger';

type Environment = 'production' | 'development';

/**
 * DatabaseContext - Service layer wrapper for database operations
 *
 * NOTE: With simplified autonomous infrastructure, this always uses the single
 * connection configured via MONGODB_URI. The environment parameter is kept for
 * backward compatibility but does not affect which database is used.
 *
 * Usage:
 * ```
 * const dbContext = new DatabaseContext('production');
 * const BotModel = dbContext.getModel('Bot', BotSchema);
 * const bot = await BotModel.findById(botId);
 * ```
 */
export class DatabaseContext {
  private readonly environment: Environment;
  private readonly connection: Connection;

  constructor(environment: Environment) {
    this.environment = environment;
    // Get single connection (environment parameter ignored in new implementation)
    this.connection = db.getConnection();

    logger.debug(`[DatabaseContext] Created context for ${environment} environment (${this.connection.name})`);
  }

  /**
   * Get a model for the current environment's connection
   *
   * @param modelName - Name of the model (e.g., 'Bot', 'BotMemory')
   * @param schema - The mongoose schema for this model
   * @returns Model instance for this environment
   */
  public getModel<T>(modelName: string, schema: Schema): Model<T> {
    return ModelFactory.getModel<T>(this.connection, modelName, schema);
  }

  /**
   * Get the underlying connection
   */
  public getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get the current environment
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Get database name for logging/debugging
   */
  public getDatabaseName(): string {
    return this.connection.name;
  }

  /**
   * Check if connection is healthy
   */
  public isHealthy(): boolean {
    return this.connection.readyState === 1;
  }

  /**
   * Execute a transaction (if supported by MongoDB setup)
   * Note: Requires replica set for multi-document transactions
   */
  public async withTransaction<T>(
    callback: (session: any) => Promise<T>
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`[DatabaseContext] Transaction failed in ${this.environment}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

/**
 * Factory function to create DatabaseContext from environment string
 */
export function createDatabaseContext(environment: string): DatabaseContext {
  if (environment !== 'production' && environment !== 'development') {
    logger.warn(`[DatabaseContext] Invalid environment '${environment}', defaulting to development`);
    return new DatabaseContext('development');
  }
  return new DatabaseContext(environment as Environment);
}
