import Redis from 'ioredis';
import PQueue from 'p-queue';
import { loadConfig } from './config';
import { BOT_CHAT_CHANNEL, parseChatEvent } from './events';
import { isPublicStandard, shouldTrigger } from './filters';
import { History } from './history';
import { OllamaClient } from './ollama';
import { BackendClient } from './backendClient';
import { BotResponder } from './responder';
import { MongoStore } from './psyche/store';
import { logger } from './logger';

async function main(): Promise<void> {
  const config = loadConfig();

  const subscriber = new Redis(config.redisUrl);
  const redis = new Redis(config.redisUrl);

  const store = await MongoStore.connect(config.mongoUri);
  const history = new History(redis);
  const ollama = new OllamaClient(config.ollamaUrl, config.model);
  const backend = new BackendClient(config.backendUrl, config.secret);
  const queue = new PQueue({ concurrency: 1 });

  const botCharacterIds: ReadonlySet<string> = new Set(config.bots.map((b) => b.characterId));
  const responders = new Map(
    config.bots.map((bot) => [bot.locationId, { bot, responder: new BotResponder(bot, { history, ollama, backend, queue, store }) }]),
  );

  subscriber.on('error', (error) => logger.error('Redis (subscriber)', { error: String(error) }));
  redis.on('error', (error) => logger.error('Redis', { error: String(error) }));

  subscriber.on('message', (_channel, raw) => {
    const event = parseChatEvent(raw);
    if (!event || !isPublicStandard(event)) return;

    const entry = responders.get(event.locationId);
    if (!entry) return;

    history
      .push(event.locationId, {
        characterId: event.characterId,
        characterName: event.characterName,
        content: event.content,
        position: event.position,
        positionDescription: event.positionDescription,
      })
      .then(() => {
        if (shouldTrigger(event, entry.bot, botCharacterIds)) entry.responder.notify();
      })
      .catch((error: unknown) => logger.error('Gestione evento fallita', { error: String(error) }));
  });

  await subscriber.subscribe(BOT_CHAT_CHANNEL);
  logger.info('bot-service attivo', {
    model: config.model,
    bots: config.bots.map((b) => `${b.name}@${b.locationId}`),
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Arresto');
    for (const { responder } of responders.values()) responder.stop();
    queue.clear();
    await Promise.allSettled([subscriber.quit(), redis.quit(), store.close()]);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  logger.error('Avvio fallito', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
