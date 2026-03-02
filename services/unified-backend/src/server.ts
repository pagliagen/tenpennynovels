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

const PORT = parseInt(process.env.PORT || '3001', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tenpennynovels';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Create HTTP server
const httpServer = http.createServer(app);

// Create Socket.IO server
// NOTE: Backend is INTERNAL - WebSocket CORS is permissive since API Gateway validates
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,  // Accept all origins (validated by API Gateway layer)
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Setup Redis adapter for Socket.IO (for horizontal scaling)
async function setupRedisAdapter(): Promise<void> {
  try {
    const pubClient = createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
      }
    });

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
    // Connect to MongoDB
    logger.info('📡 Connecting to MongoDB...');
    await db.connect(MONGODB_URI);
    logger.info('✅ MongoDB connected');

    // Connect to Redis (singleton for sessions, caching, pub/sub)
    logger.info('📡 Connecting to Redis...');
    const { redis } = await import('@config/runtime/redis');
    await redis.connect();
    logger.info('✅ Redis connected');

    // Setup Redis adapter for WebSocket
    await setupRedisAdapter();

    // Initialize Qdrant Vector DB
    logger.info('📡 Initializing Qdrant collections...');
    const { initQdrantCollections } = await import('@modules/game/utils/qdrantClient');
    await initQdrantCollections();

    // Initialize Email Service
    const { EmailService } = await import('@modules/auth/services/EmailService');
    EmailService.initialize();
    logger.info('✅ Email service initialized');

    // Initialize Notification Service with WebSocket
    const { NotificationService } = await import('@shared/services/NotificationService');
    NotificationService.initialize(io);
    logger.info('✅ Notification service initialized');

    // Start Ticket Escalation CRON Job
    await import('@modules/tickets/cron/escalation');
    logger.info('✅ Ticket escalation CRON job started');

    // Start HTTP server
    // IMPORTANT: Bind to 0.0.0.0 for Docker internal networking
    // Security is handled by api-gateway (only gateway can access backend)
    // External access to backend is blocked by Docker network isolation
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Unified Backend started on http://0.0.0.0:${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 MongoDB: ${MONGODB_URI}`);
      logger.info(`🔗 Redis: ${REDIS_HOST}:${REDIS_PORT}`);
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
