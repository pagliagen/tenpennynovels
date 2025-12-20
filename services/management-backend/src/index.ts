import dotenv from 'dotenv';
import 'module-alias/register';

console.log('🔧 Loading environment variables...');
// Load environment variables: first global, then service-specific overrides
console.log('📁 Loading global .env from project root...');
dotenv.config({ path: '../../.env' });
console.log('📁 Loading service-specific .env (if exists)...');
dotenv.config({ override: true }); // This will override with local .env if it exists
console.log('✅ Environment variables loaded');
console.log('🔍 JWT_SECRET:', process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'MISSING');

import app from './app';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { escalationService } from './services/EscalationService';
 
const PORT = process.env.PORT || 3002;

// Function to setup database connections
async function setupDatabaseConnections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectDatabase();
    console.log('✅ MongoDB connected');
    logger.info('Connected to MongoDB successfully');
    
    console.log('🔌 Connecting to Redis...');
    await connectRedis();
    console.log('✅ Redis connected');
    logger.info('Connected to Redis successfully');
    
  } catch (error: any) {
    console.error('❌ Failed to setup database connections:', error);
    logger.error('Failed to setup database connections:', error);
    throw error;
  }
}

// Start server
async function startServer() {
  try {
    console.log(`🚀 Starting Management Backend server...`);
    logger.info(`Management Backend server starting on port ${PORT}`);
    
    // Setup database connections BEFORE starting to accept requests
    await setupDatabaseConnections();
    
    console.log('✅ Database connections setup completed');
    
    // Start escalation service
    console.log('📊 Starting escalation service...');
    escalationService.start();
    console.log('✅ Escalation service started');
    logger.info('Escalation service initialized successfully');
    
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
     
    // Now start the server to accept requests
    app.listen(PORT, () => {
      console.log(`✅ Management Backend server running on port ${PORT}`);
      console.log(`🚀 Management Backend server fully operational on port ${PORT}`);
      logger.info(`Management Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;