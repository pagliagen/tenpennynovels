import Redis from 'ioredis';
import PQueue from 'p-queue';
import { loadConfig } from './config';
import { BOT_CHAT_CHANNEL, parseChatEvent } from './events';
import { isPublicStandard, shouldTrigger } from './filters';
import { History } from './history';
import { OllamaClient } from '../shared/ollama';
import { createAdminRoutes } from './admin';
import { botPathsFromEnv } from './registry';
import { BackendClient } from './backendClient';
import { BotResponder } from './responder';
import { MongoStore } from './psyche/store';
import { logger } from '../shared/logger';
import { checkOllama } from '../shared/ollama';
import type { AiService, ServiceHealth } from '../http/service';

/**
 * Il bot personaggio come servizio: Redis (pub/sub e storia), Mongo `botservice` (umore e rapporti),
 * backend di gioco (endpoint interni) e Ollama. Le rotte HTTP (`list`, `design`, `register`) servono il gestionale
 * per vedere e creare i bot (vedi `admin.ts`); la chat non passa da HTTP.
 */
export function createCharacterBot(): AiService {
  let running: {
    config: ReturnType<typeof loadConfig>;
    subscriber: Redis;
    redis: Redis;
    store: MongoStore;
    queue: PQueue;
    responders: Map<string, { bot: ReturnType<typeof loadConfig>['bots'][number]; responder: BotResponder }>;
  } | null = null;

  const service: AiService = {
    name: 'character-bot',

    async start(): Promise<void> {
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
      logger.info('character-bot attivo', {
        model: config.model,
        bots: config.bots.map((b) => `${b.name}@${b.locationId}`),
      });

      running = { config, subscriber, redis, store, queue, responders };
    },

    async stop(): Promise<void> {
      if (!running) return;
      const { subscriber, redis, store, queue, responders } = running;
      for (const { responder } of responders.values()) responder.stop();
      queue.clear();
      await Promise.allSettled([subscriber.quit(), redis.quit(), store.close()]);
      running = null;
    },

    /** Sano = Redis e Mongo rispondono e Ollama ha il modello. */
    async health(): Promise<ServiceHealth> {
      if (!running) return { ok: false, reason: 'non avviato' };
      const { config, redis, store } = running;
      try {
        if ((await redis.ping()) !== 'PONG') return { ok: false, reason: 'Redis non risponde' };
      } catch {
        return { ok: false, reason: 'Redis non raggiungibile' };
      }
      try {
        await store.ping();
      } catch {
        return { ok: false, reason: 'Mongo non raggiungibile' };
      }
      const ollama = await checkOllama(config.ollamaUrl, config.model);
      return ollama.ok ? { ok: true } : { ok: false, reason: ollama.reason ?? 'Ollama non disponibile' };
    },
  };

  // Le schede si leggono solo all'avvio: dopo `register` il servizio si riavvia da solo (1-2 s senza risposte).
  const routes = createAdminRoutes({
    paths: botPathsFromEnv(),
    llm: () => new OllamaClient(process.env.OLLAMA_URL ?? 'http://localhost:11434', process.env.OLLAMA_MODEL ?? 'gemma4:12b'),
    reload: async () => {
      await service.stop();
      await service.start();
    },
    loaded: () => new Set(running?.config.bots.map((b) => b.characterId) ?? []),
  });
  return Object.assign(service, { routes });
}
