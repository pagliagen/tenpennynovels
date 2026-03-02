// CRITICAL: Load .env BEFORE any imports that use env vars
require('dotenv').config();

import { createApp } from './app';
import { db } from './config/database';
import { claudeConfig } from './config/claude';
import { logger } from './utils/logger';
// Import all models to register them with Mongoose (required for Mongoose 7+)
import './models';

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    logger.info(`🚀 Starting BotAI Backend...`);
    logger.info(`   Environment: ${NODE_ENV}`);

    // Connect to database
    await db.connect();

    // Verify connection health
    const healthStatus = await db.healthCheck();
    logger.info(`\n📊 Database Connection:`);
    logger.info(`   Status: ${healthStatus.connection.status}`);
    logger.info(`   Database: ${healthStatus.connection.name}`);

    if (healthStatus.status !== 'healthy') {
      logger.warn('⚠️  Database connection is unhealthy');
    }

    // Test Claude API connection
    const claudeReady = await claudeConfig.testConnection();
    if (!claudeReady) {
      logger.warn('⚠️  Claude API connection test failed - bot responses may not work');
    }

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`\n✅ BotAI Backend listening on port ${PORT}`);
      logger.info(`📡 Health check: http://localhost:${PORT}/health`);
      logger.info(`🤖 Bot management: http://localhost:${PORT}/bots`);
      logger.info(`🔄 Sync endpoint: http://localhost:${PORT}/sync`);

      logger.info(`\n📝 Configuration:`);
      logger.info(`   - MongoDB: ${process.env.MONGODB_URI ? 'connected' : 'not configured'}`);
      logger.info(`   - Game Backend: ${process.env.GAME_BACKEND_URL || 'http://localhost:3000'}`);
      logger.info(`   - Claude Model: ${claudeConfig.getModel()}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await db.disconnect();
          logger.info('MongoDB connection closed');
        } catch (error) {
          logger.error('Error closing MongoDB connection:', error);
        }

        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
