import dotenv from 'dotenv';
import 'module-alias/register';

import app from './app';
import { logger } from './utils/logger';
import { db, redis } from '@config/runtime';
import { escalationService } from './services/EscalationService';

logger.info('Loading environment variables...');
// Load environment variables: first global, then service-specific overrides
logger.info('Loading global .env from project root...');
dotenv.config({ path: '../../.env' });
logger.info('Loading service-specific .env (if exists)...');
dotenv.config({ override: true }); // This will override with local .env if it exists
logger.info('Environment variables loaded');
logger.info('JWT_SECRET:', process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'MISSING');

const PORT = process.env.PORT || 3002;

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
    
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
     
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