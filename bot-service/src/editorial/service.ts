import { logger } from '../shared/logger';
import { OllamaClient, checkOllama, type Llm, type OllamaCheck } from '../shared/ollama';
import type { AiService, RouteHandler, ServiceHealth } from '../http/service';
import { loadEditorialConfig, type EditorialConfig } from './config';
import { clampTokens, generateRequestSchema } from './limits';
import { BoundedQueue, QueueFullError } from './queue';

/** Scrittura editoriale: più libera del bot (nessun formato da rispettare), ma comunque misurata. */
const TEMPERATURE = 0.6;

export interface EditorialDeps {
  config?: EditorialConfig;
  /** Sostituibile nei test. */
  llm?: Llm;
  check?: (url: string, model: string) => Promise<OllamaCheck>;
}

/**
 * Servizio `editorial`: genera bozze di testo per il gestionale. Espone `POST /v1/editorial/generate`
 * e non conosce né il gioco né i suoi dati: riceve un prompt già costruito (e già fatto solo di
 * contenuti pubblici) e restituisce testo. Non registra mai prompt o risposte, solo dimensioni e tempi.
 */
export function createEditorialService(deps: EditorialDeps = {}): AiService {
  const config = deps.config ?? loadEditorialConfig();
  const llm = deps.llm ?? new OllamaClient(config.ollamaUrl, config.model);
  const check = deps.check ?? checkOllama;
  const queue = new BoundedQueue(config.maxQueue);

  const generate: RouteHandler = async (body) => {
    const parsed = generateRequestSchema.safeParse(body);
    if (!parsed.success) return { status: 400, body: { error: 'Richiesta non valida' } };
    const { system, user, schema, maxTokens } = parsed.data;

    const messages = [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
    const options = { temperature: TEMPERATURE, numPredict: clampTokens(maxTokens, config.maxTokens) };
    const startedAt = Date.now();

    try {
      const result = await queue.run(async () => (schema ? { json: await llm.generateJson(messages, schema, options) } : { text: await llm.generate(messages, options) }));
      const ms = Date.now() - startedAt;
      logger.info('Editorial generate', { ms, systemChars: system.length, userChars: user.length, constrained: !!schema });
      return { status: 200, body: { ...result, ms } };
    } catch (error: unknown) {
      if (error instanceof QueueFullError) return { status: 429, body: { error: 'Troppe richieste in coda' } };
      // Il dettaglio (anche un eventuale frammento di prompt nell'errore) resta nei log locali, non nella response.
      logger.warn('Editorial generate fallita', { error: error instanceof Error ? error.message.slice(0, 200) : 'errore' });
      return { status: 502, body: { error: 'Modello non disponibile' } };
    }
  };

  return {
    name: 'editorial',
    routes: { generate },
    async start(): Promise<void> {
      logger.info('editorial attivo', { model: config.model, maxQueue: config.maxQueue, maxTokens: config.maxTokens });
    },
    async stop(): Promise<void> {
      queue.clear();
    },
    /** Sano = Ollama risponde e ha il modello. */
    async health(): Promise<ServiceHealth> {
      const result = await check(config.ollamaUrl, config.model);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? 'Ollama non disponibile' };
    },
  };
}
