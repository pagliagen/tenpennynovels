import mongoose from 'mongoose';
import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

/**
 * Singleton DatabaseConnection - Unified config for all modules
 *
 * Replaces:
 * - modules/auth/config/database.ts (class-based)
 * - modules/game/config/database.ts (function-based)
 * - modules/admin/config/database.ts (function-based)
 *
 * Pattern: Class-based Singleton with health checks
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    const mongoUri = appConfig.db.mongodbUri;
    if (!mongoUri) throw new Error('MONGODB_URI non configurato');

    try {
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      logger.info('✅ Database connected successfully');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('Database already disconnected');
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting database:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async healthCheck(): Promise<{ healthy: boolean; readyState: number }> {
    return {
      healthy: this.isHealthy(),
      readyState: mongoose.connection.readyState
    };
  }

  getConnection() {
    return mongoose.connection;
  }
}

// Export singleton instance for convenience
export const db = DatabaseConnection.getInstance();
