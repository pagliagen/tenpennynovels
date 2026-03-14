import app from './app';
import { logger } from './utils/logger';
import { SessionCleanupJob } from './jobs/sessionCleanup';
import 'module-alias/register';

const PORT = process.env.PORT || 3000;

// Function to setup database connections
async function setupDatabaseConnections() {
  try {
    logger.info('Connecting to MongoDB...');
    const { db } = await import('@config/runtime');
    await db.connect();
    logger.info('MongoDB connected');

    logger.info('Connecting to Redis...');
    const { redis } = await import('@config/runtime');
    await redis.connect();
    logger.info('Redis connected');

    // Initialize email service
    // Note: ConfigurationService caching disabled due to redis/ioredis library mismatch
    const { EmailService } = await import('./services/EmailService');
    EmailService.initialize();
    logger.info('Email service initialized');
    
  } catch (error: any) {
    logger.error('Failed to setup database connections:', error);
    throw error;
  }
}

// Start server
app.listen(PORT, async () => {
  logger.info(`Authentication Backend server running on port ${PORT}`);
  
  try {
    await setupDatabaseConnections();
    
    logger.info('Database connections setup completed');
    
    // Start session cleanup job (wait for it to initialize)
    logger.info('Starting session cleanup job...');
    await SessionCleanupJob.start();
    
    // Start analytics system metrics tracking
    logger.info('Starting analytics metrics tracking...');
    const { AnalyticsMiddleware } = await import('@shared/middleware/analyticsMiddleware');
    AnalyticsMiddleware.trackSystemMetrics('auth')();
    
    logger.info(`Authentication Backend server fully operational on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
  } catch (error: any) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

export default app;