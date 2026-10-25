import { createCharacterBot } from './character-bot/service';
import { createEditorialService } from './editorial/service';
import { createHttpServer } from './http/server';
import type { AiService, ServiceName } from './http/service';
import { loadLauncherConfig } from './shared/env';
import { logger } from './shared/logger';

/**
 * Launcher di bot-service: avvia SOLO i servizi elencati in `ENABLED_SERVICES` (default vuoto =
 * nessuno, per non accendere per svista un servizio sul server sbagliato) e l'HTTP interno su loopback
 * con `/health`. Ogni servizio vive nella sua cartella e non sa degli altri.
 */
const FACTORIES: Record<ServiceName, () => AiService> = {
  'character-bot': createCharacterBot,
  editorial: () => createEditorialService(),
};

async function main(): Promise<void> {
  const config = loadLauncherConfig();
  if (config.enabled.length === 0) {
    logger.warn('ENABLED_SERVICES è vuoto: nessun servizio attivo. Esempio: ENABLED_SERVICES=editorial,character-bot');
  }

  const services = config.enabled.map((name) => {
    return FACTORIES[name]();
  });

  for (const service of services) {
    await service.start();
    logger.info('Servizio avviato', { service: service.name });
  }

  const server = createHttpServer(services);
  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve));
  logger.info('bot-service attivo', { http: `${config.host}:${config.port}`, services: services.map((s) => s.name) });

  const shutdown = async (): Promise<void> => {
    logger.info('Arresto');
    server.close();
    await Promise.allSettled(services.map((s) => s.stop()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  logger.error('Avvio fallito', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
