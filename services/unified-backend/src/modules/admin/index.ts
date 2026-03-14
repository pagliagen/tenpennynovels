import dotenv from 'dotenv';
import 'module-alias/register';

import app from './app';
import { logger } from './utils/logger';
import { db, redis, appConfig } from '@config/runtime';
import { escalationService } from './services/EscalationService';

logger.info('Loading environment variables...');
dotenv.config({ path: '../../.env' });
dotenv.config({ override: true });
logger.info('Environment variables loaded');
logger.info('JWT_SECRET:', appConfig.jwt.secret ? 'SET' : 'MISSING');

const PORT = appConfig.port;

// Function to setup database connections
async function setupDatabaseConnections() {
  try {
    logger.info('Connecting to MongoDB...');
    await db.connect();
    logger.info('MongoDB connected');
    
    logger.info('Connecting to Redis...');
    await redis.connect();
    logger.info('Redis connected');
    
  } catch (error: any) {
    logger.error('Failed to setup database connections:', error);
    throw error;
  }
}

// Start server
async function startServer() {
  try {
    logger.info('Starting Management Backend server...');
    
    // Setup database connections BEFORE starting to accept requests
    await setupDatabaseConnections();
    
    logger.info('Database connections setup completed');
    
    // Start escalation service
    logger.info('Starting escalation service...');
    escalationService.start();
    logger.info('Escalation service started');
    
    logger.info(`Environment: ${appConfig.isProduction ? 'production' : 'development'}`);
     
    // Now start the server to accept requests
    app.listen(PORT, () => {
      logger.info(`Management Backend server running on port ${PORT}`);
      logger.info(`Management Backend server fully operational on port ${PORT}`);
    });
    
  } catch (error: any) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;