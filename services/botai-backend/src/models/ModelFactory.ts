import { Connection, Model, Schema } from 'mongoose';
import { logger } from '../utils/logger';

/**
 * ModelFactory - Creates and caches Mongoose models per connection
 *
 * Since we have multiple database connections (production and development),
 * we need to register models on each connection separately. Mongoose's global
 * model registry doesn't work with multiple connections.
 */
export class ModelFactory {
  /**
   * Get or create a model for a specific connection
   *
   * @param connection - The mongoose connection to use
   * @param modelName - Name of the model (e.g., 'Bot', 'BotMemory')
   * @param schema - The mongoose schema for this model
   * @returns Model instance registered on the specified connection
   */
  static getModel<T>(
    connection: Connection,
    modelName: string,
    schema: Schema
  ): Model<T> {
    try {
      // Check if model already exists on this connection
      if (connection.models[modelName]) {
        return connection.models[modelName] as Model<T>;
      }

      // Register new model on this connection
      const model = connection.model<T>(modelName, schema);

      logger.debug(`[ModelFactory] Registered model '${modelName}' on connection '${connection.name}'`);

      return model;

    } catch (error) {
      logger.error(`[ModelFactory] Failed to get/create model '${modelName}':`, error);
      throw error;
    }
  }

  /**
   * Check if a model exists on a connection
   */
  static hasModel(connection: Connection, modelName: string): boolean {
    return !!connection.models[modelName];
  }

  /**
   * Get all registered model names for a connection
   */
  static getModelNames(connection: Connection): string[] {
    return Object.keys(connection.models);
  }
}
