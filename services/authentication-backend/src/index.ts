import app from './app';
import { logger } from './utils/logger';
import { SessionCleanupJob } from './jobs/sessionCleanup';
import 'module-alias/register';

const PORT = process.env.PORT || 3000;

// Function to setup database connections
async function setupDatabaseConnections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const { db } = await import('./config/database');
    await db.connect();
    console.log('✅ MongoDB connected');
    logger.info('Connected to MongoDB successfully');
    
    console.log('🔌 Connecting to Redis...');
    const { redis } = await import('./config/redis');
    await redis.connect();
    console.log('✅ Redis connected');
    logger.info('Connected to Redis successfully');

    // Initialize email service with Redis for configuration caching
    const { EmailService } = await import('./services/EmailService');
    EmailService.initialize(redis);
    console.log('✅ Email service initialized with ConfigurationService');
    logger.info('Email service initialized with ConfigurationService');
    
  } catch (error: any) {
    console.error('❌ Failed to setup database connections:', error);
    logger.error('Failed to setup database connections:', error);
    throw error;
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`✅ Authentication Backend server running on port ${PORT}`);
  logger.info(`Authentication Backend server starting on port ${PORT}`);
  
  try {
    await setupDatabaseConnections();
    
    console.log('✅ Database connections setup completed');
    
    // Start session cleanup job
    console.log('🧹 Starting session cleanup job...');
    SessionCleanupJob.start();
    
    // Start analytics system metrics tracking
    console.log('📊 Starting analytics metrics tracking...');
    const { AnalyticsMiddleware } = await import('../../../packages/shared/src/middleware/analyticsMiddleware');
    AnalyticsMiddleware.trackSystemMetrics('auth')();
    
    console.log(`🚀 Authentication Backend server fully operational on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
     
    logger.info(`Authentication Backend running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

export default app;