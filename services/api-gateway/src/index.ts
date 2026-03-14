import dotenv from 'dotenv';

// Carica variabili d'ambiente: prima globali, poi specifiche del servizio
dotenv.config({ path: '../../.env' });
dotenv.config({ override: true });

import app from './app';
import { logger } from './utils/logger';
import { config } from './config';

// ---------------------------------------------------------------------------
// Handler errori non gestiti
// ---------------------------------------------------------------------------
process.on('uncaughtException', (error) => {
  logger.error('Eccezione non catturata nel gateway:', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejection non gestita nel gateway:', { reason });
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Avvio server
// ---------------------------------------------------------------------------
const server = app.listen(config.port, () => {
  logger.info(`API Gateway avviato sulla porta ${config.port}`);
  logger.info(`Ambiente: ${config.isProduction ? 'production' : 'development'}`);
  logger.info('Routing attivo: /auth, /game, /forum, /documents, /admin, /cdn, /socket.io');
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function gracefulShutdown(signal: string) {
  logger.info(`${signal} ricevuto. Chiusura in corso...`);

  server.close(() => {
    logger.info('Server API Gateway chiuso');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Timeout chiusura. Uscita forzata.');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
