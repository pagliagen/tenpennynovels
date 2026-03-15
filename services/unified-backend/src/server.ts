// CRITICAL: Load .env BEFORE any imports
require('dotenv').config();

// Load module-alias only in production (tsx handles paths in dev)
if (process.env.NODE_ENV === 'production') {
  require('module-alias/register');
}

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import app from './app';
import { db } from '@database/connection';
import { logger } from '@shared/utils/logger';
import { validateEnvironment } from '@config/runtime/envValidation';
import { appConfig } from '@config/runtime';

// Create HTTP server
const httpServer = http.createServer(app);

// Create Socket.IO server
// NOTE: Backend is INTERNAL - WebSocket CORS is permissive since API Gateway validates
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: appConfig.isProduction ? false : true,
    credentials: appConfig.isProduction ? false : true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Setup Redis adapter for Socket.IO (for horizontal scaling)
async function setupRedisAdapter(): Promise<void> {
  try {
    const pubClient = createClient({ url: appConfig.db.redisUrl });

    const subClient = pubClient.duplicate();

    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('✅ Socket.IO Redis adapter configured');

    // Error handlers
    pubClient.on('error', (err) => logger.error('Redis Pub Client Error:', err));
    subClient.on('error', (err) => logger.error('Redis Sub Client Error:', err));
  } catch (error: any) {
    logger.error('❌ Failed to setup Redis adapter:', error);
    logger.warn('⚠️  Running without Redis adapter (single instance mode)');
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    const envCheck = validateEnvironment();
    if (!envCheck.isValid) {
      logger.error('Server non avviato: variabili d\'ambiente mancanti');
      process.exit(1);
    }
 
    // Connect to MongoDB
    logger.info('📡 Connecting to MongoDB...');
    await db.connect();
    logger.info('✅ MongoDB connected');

    // Connect to Redis (singleton for sessions, caching, pub/sub)
    logger.info('📡 Connecting to Redis...');
    const { redis } = await import('@config/runtime/redis');
    await redis.connect();
    logger.info('✅ Redis connected');

    // Setup Redis adapter for WebSocket
    await setupRedisAdapter();

    // Initialize Email Service
    const { EmailService } = await import('@modules/auth/services/EmailService');
    EmailService.initialize();
    logger.info('✅ Email service initialized');

    // Initialize Notification Service with WebSocket
    const { NotificationService } = await import('@shared/services/NotificationService');
    NotificationService.initialize(io);
    logger.info('✅ Notification service initialized');

    // Start Sitemap CRON Job (daily at 03:00 + immediate on boot)
    await import('./cron/sitemapGeneration');
    logger.info('✅ Sitemap CRON job started');

    // Start Presence Cleanup CRON Job (every 5 minutes, feature flag controlled)
    if (appConfig.features.presenceCleanup) {
      await import('./cron/presenceCleanup');
      logger.info('✅ Presence cleanup CRON job started');
    }

    // Start HTTP server
    // IMPORTANT: Bind to 0.0.0.0 for Docker internal networking
    // Security is handled by api-gateway (only gateway can access backend)
    // External access to backend is blocked by Docker network isolation
    httpServer.listen(appConfig.port, appConfig.bindHost, () => {
      logger.info(`🚀 Unified Backend started on http://${appConfig.bindHost}:${appConfig.port}`);
      logger.info(`📊 Environment: ${appConfig.isProduction ? 'production' : 'development'}`);
      logger.info(`🔗 MongoDB: ${appConfig.db.mongodbUri}`);
      logger.info(`🔗 Redis: ${appConfig.db.redisUrl}`);
    });

    // Import and setup WebSocket handlers (after io is created)
    try {
      const { setupWebSocket } = await import('@modules/game/websocket');
      const { setSocketIO } = await import('@modules/game/websocket/socketInstance');

      await setupWebSocket(io);

      // Register Socket.IO instance in singleton for controllers
      setSocketIO(io);

      logger.info('✅ WebSocket handlers initialized');
    } catch (error: any) {
      logger.error('❌ Failed to initialize WebSocket handlers:', error);
      logger.warn('⚠️  WebSocket server running without handlers');
    }

  } catch (error: any) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n📴 ${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('✅ HTTP server closed');

    try {
      // Shutdown Redis Subscriber
      try {
        const { getRedisSubscriber } = await import('@modules/game/websocket');
        const subscriber = getRedisSubscriber();
        if (subscriber) {
          await subscriber.shutdown();
          logger.info('✅ Redis Subscriber chiuso');
        }
      } catch (e) {
        logger.warn('Redis Subscriber shutdown skipped');
      }

      // Close WebSocket connections
      io.close(() => {
        logger.info('✅ WebSocket server closed');
      });

      // Disconnect from MongoDB
      await db.disconnect();
      logger.info('✅ MongoDB disconnected');

      logger.info('👋 Graceful shutdown complete');
      process.exit(0);
    } catch (error: any) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1); 
    }
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('⏰ Graceful shutdown timeout. Forcing exit...');
    process.exit(1);
  }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Export io for use in other modules
export { io };

// Start the server
startServer();
