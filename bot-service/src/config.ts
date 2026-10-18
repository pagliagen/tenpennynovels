import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { z } from 'zod';

const envSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  BACKEND_URL: z.string().url().default('http://localhost:3001'),
  BOT_SERVICE_SECRET: z.string().min(16, 'BOT_SERVICE_SECRET mancante o troppo corto'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:12b'),
  BOTS_DIR: z.string().default('./bots'),
  MAPPING_FILE: z.string().default('./mapping.json'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI mancante'),
});

const score = z.number().min(0).max(100);

/** La scheda psicologica: numeri nel codice, tradotti in frasi prima di arrivare al modello. */
export const psycheSchema = z.object({
  /** Big Five, 1-100: la linea di condotta di fondo. */
  ocean: z.object({
    O: z.number().min(1).max(100),
    C: z.number().min(1).max(100),
    E: z.number().min(1).max(100),
    A: z.number().min(1).max(100),
    N: z.number().min(1).max(100),
  }),
  /** Motivazione profonda (Enneagramma). */
  enneagram: z.object({
    type: z.number().int().min(1).max(9),
    fear: z.string().min(3),
    desire: z.string().min(3),
  }),
  /** Umore di base (PAD, -1..1): a cui l'umore torna col tempo. */
  pad: z.object({
    p: z.number().min(-1).max(1),
    a: z.number().min(-1).max(1),
    d: z.number().min(-1).max(1),
  }),
  /** Come vede uno sconosciuto (0-100). Se manca, deriva da Gradevolezza e Nevroticismo. */
  stranger: z.object({ trust: score, respect: score, suspicion: score }).optional(),
});

export type Psyche = z.infer<typeof psycheSchema>;

/** Un bot: scheda e stile, indipendenti da dove viene usato. File `bots/<nome>.json`. */
export const botDefSchema = z.object({
  name: z.string().min(1),
  /** _id del Character bot nel game (e id del bot nel mapping). */
  characterId: z.string().min(1),
  persona: z.string().min(20),
  psyche: psycheSchema,
  /** 'all': risponde a ogni messaggio; 'mention': solo se citato per nome. */
  respondTo: z.enum(['all', 'mention']).default('all'),
  /** Pausa minima tra due risposte dello stesso bot. */
  cooldownMs: z.number().int().min(0).default(15_000),
  /** Attesa dopo l'ultimo messaggio, per raccogliere una raffica in una sola risposta. */
  debounceMs: z.number().int().min(0).default(3_000),
  historySize: z.number().int().min(1).max(50).default(12),
  /** Lunghezza voluta, chiesta nel prompt (non imposta tagliando l'output). */
  targetWords: z.number().int().min(10).max(300).default(60),
  temperature: z.number().min(0).max(2).default(0.6),
});

/** Il bot in una location: è ciò con cui lavora il resto del servizio. */
export const botSchema = botDefSchema.extend({ locationId: z.string().min(1) });

/** `mapping.json`: quale bot sta in quale location. */
export const mappingSchema = z.array(z.object({ locationId: z.string().min(1), botId: z.string().min(1) }));

export type BotConfig = z.infer<typeof botSchema>;

export interface Config {
  redisUrl: string;
  backendUrl: string;
  secret: string;
  ollamaUrl: string;
  model: string;
  mongoUri: string;
  bots: BotConfig[];
}

export function loadBotDefs(dir: string): z.infer<typeof botDefSchema>[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.example.json'))
    .map((f) => {
      try {
        return botDefSchema.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
      } catch (error) {
        throw new Error(`Bot ${f} non valido: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

/** Unisce le schede dei bot con la mappatura location → bot. */
export function resolveBots(defs: z.infer<typeof botDefSchema>[], mapping: z.infer<typeof mappingSchema>): BotConfig[] {
  const byId = new Map(defs.map((d) => [d.characterId, d]));
  const locations = new Set<string>();
  return mapping.map(({ locationId, botId }) => {
    const def = byId.get(botId);
    if (!def) throw new Error(`mapping: nessun bot con characterId ${botId} in bots/`);
    if (locations.has(locationId)) throw new Error(`mapping: più bot sulla stessa location (${locationId}): non supportato`);
    locations.add(locationId);
    return botSchema.parse({ ...def, locationId });
  });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = envSchema.parse(env);
  const defs = loadBotDefs(e.BOTS_DIR);
  const mapping = mappingSchema.min(1).parse(JSON.parse(readFileSync(e.MAPPING_FILE, 'utf8')));

  return {
    redisUrl: e.REDIS_URL,
    backendUrl: e.BACKEND_URL,
    secret: e.BOT_SERVICE_SECRET,
    ollamaUrl: e.OLLAMA_URL,
    model: e.OLLAMA_MODEL,
    mongoUri: e.MONGODB_URI,
    bots: resolveBots(defs, mapping),
  };
}
