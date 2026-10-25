import PQueue from 'p-queue';
import { loadConfig } from './config';
import { createEventHandler } from './intake';
import { OllamaClient } from '../shared/ollama';
import { BotResponder } from './responder';
import { MongoStore } from './psyche/store';
import { logger } from '../shared/logger';
import { checkOllama } from '../shared/ollama';
import { createAdminRoutes } from './admin';
import { botPathsFromEnv } from './registry';
import type { AiService, ServiceHealth } from '../http/service';

/**
 * Il bot personaggio come servizio. Lo chiama il gioco (`POST /v1/character-bot/event`, attraverso il gateway) a ogni
 * messaggio pubblico di una location che ha un bot; l'evento porta con sé la storia, l'indirizzo a cui rispondere e il
 * token per farlo. Il servizio decide se e cosa rispondere (Ollama) e risponde a quell'indirizzo: non conosce ambienti,
 * URL né segreti di gioco, e non ha Redis. Tiene solo umore e rapporti (Mongo `botservice`).
 * Le altre azioni (`list`, `design`, `register`) servono il gestionale: vedi `admin.ts`.
 */
export function createCharacterBot(): AiService {
  type Entry = { bot: ReturnType<typeof loadConfig>['bots'][number]; responder: BotResponder };
  let running: {
    config: ReturnType<typeof loadConfig>;
    store: MongoStore;
    queue: PQueue;
    /** `<ambiente>:<locationId>` → bot. Le location hanno gli stessi id in ogni ambiente: la chiave li distingue. */
    responders: Map<string, Entry>;
    /** characterId dei bot per ambiente: nessun bot risponde a un bot. */
    botIds: Map<string, Set<string>>;
  } | null = null;

  const event = createEventHandler(() => (running ? { allowedReplyOrigins: running.config.allowedReplyOrigins, responders: running.responders, botIds: running.botIds } : null));

  const service: AiService = {
    name: 'character-bot',

    async start(): Promise<void> {
      const config = loadConfig();
      const store = await MongoStore.connect(config.mongoUri);
      const ollama = new OllamaClient(config.ollamaUrl, config.model);
      const queue = new PQueue({ concurrency: 1 });

      const responders = new Map<string, Entry>(
        config.bots.map((bot) => [`${bot.environment}:${bot.locationId}`, { bot, responder: new BotResponder(bot, { ollama, store, queue }) }]),
      );
      const botIds = new Map<string, Set<string>>();
      for (const bot of config.bots) botIds.set(bot.environment, (botIds.get(bot.environment) ?? new Set()).add(bot.characterId));

      logger.info('character-bot attivo', {
        model: config.model,
        bots: config.bots.map((b) => `${b.name}@${b.environment}:${b.locationId}`),
        allowedReplyOrigins: config.allowedReplyOrigins,
      });
      if (config.allowedReplyOrigins.length === 0) {
        logger.warn('ALLOWED_REPLY_ORIGINS è vuota: il servizio non accetta nessun evento dal gioco (fail-closed)');
      }
      running = { config, store, queue, responders, botIds };
    },

    async stop(): Promise<void> {
      if (!running) return;
      const { store, queue, responders } = running;
      for (const { responder } of responders.values()) responder.stop();
      queue.clear();
      await Promise.allSettled([store.close()]);
      running = null;
    },

    /** Sano = Mongo risponde e Ollama ha il modello. */
    async health(): Promise<ServiceHealth> {
      if (!running) return { ok: false, reason: 'non avviato' };
      try {
        await running.store.ping();
      } catch {
        return { ok: false, reason: 'Mongo non raggiungibile' };
      }
      const ollama = await checkOllama(running.config.ollamaUrl, running.config.model);
      return ollama.ok ? { ok: true } : { ok: false, reason: ollama.reason ?? 'Ollama non disponibile' };
    },
  };

  // Le schede si leggono solo all'avvio: dopo `register` il servizio si riavvia da solo (1-2 s senza risposte).
  const admin = createAdminRoutes({
    paths: botPathsFromEnv(),
    llm: () => new OllamaClient(process.env.OLLAMA_URL ?? 'http://localhost:11434', process.env.OLLAMA_MODEL ?? 'gemma4:12b'),
    reload: async () => {
      await service.stop();
      await service.start();
    },
    loaded: () => new Set(running ? [...running.responders.values()].map((e) => e.bot.characterId) : []),
  });
  return Object.assign(service, { routes: { ...admin, event } });
}
