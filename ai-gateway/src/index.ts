import { loadConfig } from './config';
import { logger } from './logger';
import { createGatewayServer } from './server';

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createGatewayServer(config);
  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve));
  logger.info('ai-gateway attivo', { listen: `${config.host}:${config.port}`, upstream: config.botServiceUrl });

  const shutdown = (): void => {
    logger.info('Arresto');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  logger.error('Avvio fallito', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
