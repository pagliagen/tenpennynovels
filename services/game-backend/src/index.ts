// import 'module-alias/register';
import dotenv from 'dotenv';
import 'module-alias/register';

console.log('Loading environment variables...');
// Load environment variables: first global, then service-specific overrides
console.log('📁 Loading global .env from project root...');
dotenv.config({ path: '../../.env' });
console.log('📁 Loading service-specific .env (if exists)...');
dotenv.config({ override: true });  // This will override with local .env if it exists
console.log('Environment loaded, importing app...');
console.log('🔍 JWT_SECRET:', process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'MISSING');

// Import the Express app
import app, { setupProcessHandlers, setupDatabaseConnections, initializeRateLimiters } from './app';

// Import controllers to register decorators
import './controllers/CharacterController';

console.log('App imported successfully');
  
// Start server here
const PORT = process.env.PORT || 3001;
console.log(`Attempting to start server on port ${PORT}...`);

const server = app.listen(PORT, async () => {
  // Import logger here to avoid circular imports
  const { logger } = await import('./utils/logger');
  
  logger.info(`Game Backend server starting on port ${PORT}`);
  
  try {
    // Setup database connections
    await setupDatabaseConnections();

    // Ensure models are loaded before accessing configurations
    await import('../../database/models');

    // Initialize rate limiters with values from database
    await initializeRateLimiters();

    // Setup WebSocket server
    const { Server } = await import('socket.io');
    const { setupWebSocket } = await import('./websocket');
    
    const io = new Server(server, {
      cors: {
        origin: [
          // Development origins
          'http://localhost:4000',
          'http://localhost:4001',
          'http://localhost:4002',
          'http://localhost:4003',
          'http://localhost:4004',
          'http://localhost:4005',
          // Production origins
          'https://tenpennynovels.com',
          'https://game.tenpennynovels.com',
          'https://documenti.tenpennynovels.com',
          'https://forum.tenpennynovels.com',
          'https://gestione.tenpennynovels.com',
          'https://supporto.tenpennynovels.com'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    await setupWebSocket(io);
    
    // Attach io instance to app for use in controllers
    app.set('io', io);
    
    // Initialize postal delivery service
    const { postalDeliveryService } = await import('./cron/postalDelivery');
    postalDeliveryService.initialize();

    // Initialize daily experience cron jobs
    const { initializeDailyExperienceCrons } = await import('./cron/dailyExperience');
    await initializeDailyExperienceCrons();

    // Initialize credit line reset service
    const { CreditLineResetService } = await import('./services/CreditLineResetService');
    await CreditLineResetService.initialize();
    
    // Initialize automated rent collection system
    const { startRentCollectionCron } = await import('./cron/rentCollection');
    await startRentCollectionCron();
    
    // Start analytics system metrics tracking
    console.log('📊 Starting analytics metrics tracking...');
    const { AnalyticsMiddleware } = await import('../../shared/src/middleware/analyticsMiddleware');
    AnalyticsMiddleware.trackSystemMetrics('game')();
    
    console.log('🔌 WebSocket server initialized');
    console.log('📮 Postal delivery service initialized');
    console.log('⭐ Daily experience system initialized');
    console.log('💰 Credit line reset service initialized');
    console.log('🏠 Rent collection system initialized');
    console.log('📊 Analytics metrics tracking started');
    logger.info('WebSocket server initialized');
    logger.info('Postal delivery service initialized');
    logger.info('Daily experience system initialized');
    logger.info('Credit line reset service initialized');
    logger.info('Rent collection system initialized');
    logger.info('Analytics metrics tracking started');
    
    console.log(`🚀 Game Backend server fully operational on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
     
    // Also log with winston (mixed output for now)
    logger.info(`Game Backend server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Setup process handlers for graceful shutdown
setupProcessHandlers(server);

console.log('🔧 Server startup initiated');