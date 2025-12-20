import app from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 8000;

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in API Gateway:', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection in API Gateway:', { 
    reason: reason, 
    promise: promise 
  });
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ API Gateway server running on port ${PORT}`);
  logger.info(`API Gateway server starting on port ${PORT}`);
  
  console.log('✅ API Gateway server fully operational');
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Gateway info: http://localhost:${PORT}/`);
  console.log('📡 Service Routes:');
  console.log(`   Authentication:     http://localhost:${PORT}/auth/*`);
  console.log(`   Game Backend:       http://localhost:${PORT}/game/*`);
  console.log(`   Forum Backend:      http://localhost:${PORT}/forum/*`);
  console.log(`   Documents Backend:  http://localhost:${PORT}/documents/*`);
  console.log(`   Management:         http://localhost:${PORT}/admin/*`); 
  
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Service routing active for: /auth, /game, /admin, /forum, /documents');
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('API Gateway server closed');
    logger.info('API Gateway server closed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;