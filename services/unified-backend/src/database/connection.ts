import mongoose from 'mongoose';
import { logger } from '@shared/utils/logger';

class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private isConnected = false;

  private constructor() {}

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  async connect(mongoUri: string): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });

    this.isConnected = true;
    logger.info('MongoDB connected');

    // Event handlers
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB error:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      this.isConnected = true;
    });
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await mongoose.disconnect();
    this.isConnected = false;
  }

  isConnectionHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      if (!this.isConnected) {
        return { status: 'unhealthy', details: { error: 'Not connected' } };
      }

      await mongoose.connection.db?.admin().ping();

      return {
        status: 'healthy',
        details: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Errore sconosciuto',
          readyState: mongoose.connection.readyState
        }
      };
    }
  }

  getConnection() {
    return mongoose.connection;
  }

  getMongoose() {
    return mongoose;
  }
}

export const db = DatabaseConnectionManager.getInstance();
