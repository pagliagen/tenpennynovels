import mongoose, { Connection } from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Simplified Database Manager - Single Connection
 *
 * Each BotAI instance connects to ONE MongoDB database via MONGODB_URI.
 * For multiple environments, deploy separate BotAI instances with different MONGODB_URI values.
 */
class Database {
  private static instance: Database;
  private connection: Connection | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Initialize database connection
   */
  public async connect(): Promise<void> {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/botai';

      if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is required');
      }

      logger.info('🔌 Connecting to MongoDB...');

      // Create single connection
      this.connection = mongoose.createConnection(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      this.setupConnectionHandlers(this.connection);

      // Wait for connection to be established
      await this.connection.asPromise();

      this.isConnected = true;
      logger.info(`✅ MongoDB connected: ${this.getMaskedUri(mongoUri)}`);
      logger.info(`   Database: ${this.connection.name}`);

    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for connection
   */
  private setupConnectionHandlers(connection: Connection): void {
    connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB disconnected');
      this.isConnected = false;
    });

    connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
      this.isConnected = true;
    });

    connection.on('connected', () => {
      logger.debug('MongoDB connected');
      this.isConnected = true;
    });
  }

  /**
   * Get the database connection
   * Environment parameter kept for backward compatibility but ignored
   */
  public getConnection(_environment?: string): Connection {
    if (!this.isConnected || !this.connection) {
      throw new Error('Database not connected. Call connect() first.');
    }

    return this.connection;
  }

  /**
   * Check if connection is healthy
   */
  public isConnectionHealthy(): boolean {
    return this.isConnected && this.connection?.readyState === 1;
  }

  /**
   * Get health status of connection
   */
  public async healthCheck(): Promise<{
    status: string;
    connection: {
      status: string;
      readyState: number;
      name: string;
    };
  }> {
    const conn = this.connection;

    return {
      status: this.isConnectionHealthy() ? 'healthy' : 'unhealthy',
      connection: {
        status: conn?.readyState === 1 ? 'connected' : 'disconnected',
        readyState: conn?.readyState || 0,
        name: conn?.name || 'unknown'
      }
    };
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
        logger.info('MongoDB connection closed');
      }

      this.isConnected = false;
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
      throw error;
    }
  }

  /**
   * Mask password in connection string for logging
   */
  private getMaskedUri(uri: string): string {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  }
}

export const db = Database.getInstance();
