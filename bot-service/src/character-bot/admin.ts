import { z } from 'zod';
import { logger } from '../shared/logger';
import type { Llm } from '../shared/ollama';
import type { RouteHandler } from '../http/service';
import { environmentSchema } from './config';
import { designBot } from './designer';
import { listBots, registerBot, RegisterError, type BotPaths } from './registry';

/**
 * Le tre azioni che il gestionale usa sul character-bot (`POST /v1/character-bot/<azione>`):
 * `list` (i bot di un ambiente e se sono attivi), `design` (genera una bozza, non salva) e `register` (scrive scheda e mapping e ricarica).
 * Non toccano mai il database di gioco: il personaggio lo crea il backend.
 */

export interface AdminDeps {
  paths: BotPaths;
  llm: () => Llm;
  /** Ricarica il servizio dopo `register`: le schede si leggono solo all'avvio. */
  reload: () => Promise<void>;
  /** characterId dei bot attualmente caricati dal servizio. */
  loaded: () => ReadonlySet<string>;
}

const designSchema = z.object({
  description: z.string().trim().min(20).max(2000),
  location: z.object({
    name: z.string().trim().min(1).max(200),
    quartiere: z.string().trim().max(200).nullable().default(null),
    district: z.string().trim().max(200).nullable().default(null),
    tags: z.array(z.string().max(100)).max(10).default([]),
    description: z.string().max(3000).default(''),
    positions: z.array(z.string().max(100)).max(30).default([]),
  }),
  existingNames: z.array(z.string().max(200)).max(500).default([]),
});

const registerSchema = z.object({ locationId: z.string(), environment: environmentSchema.optional(), sheet: z.unknown() });
const listSchema = z.object({ environment: environmentSchema.optional() });

export function createAdminRoutes(deps: AdminDeps): Record<'list' | 'design' | 'register', RouteHandler> {
  /** Una generazione alla volta: il modello è uno solo e una bozza lunga non deve accodarsi dietro alle risposte in chat. */
  let designing = false;
  /** `register` e ricarica non si sovrappongono. */
  let registering: Promise<unknown> = Promise.resolve();

  const list: RouteHandler = async (body) => {
    const parsed = listSchema.safeParse(body ?? {});
    if (!parsed.success) return { status: 400, body: { error: 'Richiesta non valida' } };
    const { environment } = parsed.data;
    try {
      const loaded = deps.loaded();
      const all = listBots(deps.paths);
      // Con un ambiente: solo i suoi bot; gli altri si contano e basta (il loro personaggio non esiste in quel database).
      const mine = environment ? all.filter((b) => b.environment === environment) : all;
      return { status: 200, body: { bots: mine.map((b) => ({ ...b, active: loaded.has(b.characterId) })), hiddenOtherEnvironments: all.length - mine.length } };
    } catch (error: unknown) {
      logger.warn('character-bot list fallita', { error: error instanceof Error ? error.message.slice(0, 200) : 'errore' });
      return { status: 500, body: { error: 'Schede dei bot non leggibili' } };
    }
  };

  const design: RouteHandler = async (body) => {
    const parsed = designSchema.safeParse(body);
    if (!parsed.success) return { status: 400, body: { error: 'Richiesta non valida' } };
    if (designing) return { status: 429, body: { error: 'Una generazione è già in corso' } };
    designing = true;
    const startedAt = Date.now();
    try {
      const result = await designBot(deps.llm(), parsed.data);
      const ms = Date.now() - startedAt;
      // Mai la descrizione né la bozza nei log: solo dimensioni e tempi.
      logger.info('character-bot design', { ms, attempts: result.attempts, ok: result.checks.every((c) => c.ok), hasDraft: !!result.draft });
      return { status: 200, body: { ...result, ms } };
    } catch (error: unknown) {
      logger.warn('character-bot design fallita', { error: error instanceof Error ? error.message.slice(0, 200) : 'errore' });
      return { status: 502, body: { error: 'Modello non disponibile' } };
    } finally {
      designing = false;
    }
  };

  const register: RouteHandler = async (body) => {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return { status: 400, body: { error: 'Richiesta non valida' } };

    const run = async () => {
      let written: { file: string; characterId: string };
      try {
        written = registerBot(deps.paths, { locationId: parsed.data.locationId, ...(parsed.data.environment ? { environment: parsed.data.environment } : {}), sheet: parsed.data.sheet });
      } catch (error: unknown) {
        if (error instanceof RegisterError) return { status: error.code === 'invalid' ? 400 : 409, body: { error: error.message, code: error.code } };
        logger.error('character-bot register fallita', { error: error instanceof Error ? error.message.slice(0, 200) : 'errore' });
        return { status: 500, body: { error: 'Scrittura delle schede non riuscita' } };
      }
      // Scheda e mapping sono scritti: se la ricarica fallisce il bot esiste, solo non è ancora attivo.
      let reloaded = true;
      try {
        await deps.reload();
      } catch (error: unknown) {
        reloaded = false;
        logger.error('character-bot ricarica fallita dopo register', { error: error instanceof Error ? error.message.slice(0, 200) : 'errore' });
      }
      return { status: 200, body: { ...written, reloaded } };
    };

    const result = registering.then(run, run);
    registering = result.catch(() => undefined);
    return result;
  };

  return { list, design, register };
}
