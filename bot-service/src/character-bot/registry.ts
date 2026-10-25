import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { botDefSchema, DEFAULT_ENVIRONMENT, environmentSchema, loadMapping, mappingSchema } from './config';

/**
 * I file di un bot: `bots/<nome>.json` (la scheda) e una riga in `mapping.json` (location → bot).
 * Questo modulo li legge e ne aggiunge di nuovi, mai in modo distruttivo: non sovrascrive e non rimuove.
 */

export interface BotPaths {
  botsDir: string;
  mappingFile: string;
}

export function botPathsFromEnv(env: NodeJS.ProcessEnv = process.env): BotPaths {
  return { botsDir: env.BOTS_DIR ?? './bots', mappingFile: env.MAPPING_FILE ?? './mapping.json' };
}

export interface BotListing {
  name: string;
  characterId: string;
  environment: string;
  /** null = scheda senza location (non mappata). */
  locationId: string | null;
  file: string;
}

export type RegisterErrorCode = 'invalid' | 'file-exists' | 'location-taken' | 'character-taken';

export class RegisterError extends Error {
  constructor(readonly code: RegisterErrorCode, message: string) {
    super(message);
  }
}

const OBJECT_ID = /^[0-9a-f]{24}$/;

/** Nome file sicuro: minuscole, cifre e trattini. Niente separatori di percorso, niente punti. */
export function botSlug(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function botFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.example.json')) : [];
}

export function listBots(paths: BotPaths): BotListing[] {
  const mapping = loadMapping(paths.mappingFile);
  const locationOf = new Map(mapping.map((m) => [m.botId, m.locationId]));
  return botFiles(paths.botsDir).map((file) => {
    const def = botDefSchema.parse(JSON.parse(readFileSync(path.join(paths.botsDir, file), 'utf8')));
    return { name: def.name, characterId: def.characterId, environment: def.environment, locationId: locationOf.get(def.characterId) ?? null, file };
  });
}

/** Scrittura atomica: file temporaneo nella stessa cartella e rename (mai un JSON a metà). */
function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, file);
}

export interface RegisterInput {
  locationId: string;
  /** Ambiente del bot (default `local`): la scheda e la riga di mapping lo portano. */
  environment?: string;
  /** La scheda (name, characterId, persona, psyche, ...): validata con `botDefSchema`. */
  sheet: unknown;
}

/**
 * Aggiunge un bot: scheda in `bots/` e riga nel mapping. Una location ha un solo bot. Se la scrittura del mapping
 * fallisce, la scheda appena scritta viene tolta: non resta mezzo bot.
 */
export function registerBot(paths: BotPaths, input: RegisterInput): { file: string; characterId: string } {
  if (!OBJECT_ID.test(input.locationId)) throw new RegisterError('invalid', 'locationId non valido');
  const environment = input.environment ?? DEFAULT_ENVIRONMENT;
  if (!environmentSchema.safeParse(environment).success) throw new RegisterError('invalid', 'ambiente non valido');
  const parsed = botDefSchema.safeParse({ ...(input.sheet as Record<string, unknown> | null), environment });
  if (!parsed.success) throw new RegisterError('invalid', `Scheda non valida: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const def = parsed.data;
  if (!OBJECT_ID.test(def.characterId)) throw new RegisterError('invalid', 'characterId non valido');

  const slug = botSlug(def.name);
  if (!slug) throw new RegisterError('invalid', 'Il nome non produce un nome file valido');
  // Due ambienti possono avere un bot con lo stesso nome: fuori da `local` il nome file porta l'ambiente.
  const file = environment === DEFAULT_ENVIRONMENT ? `${slug}.json` : `${slug}-${environment}.json`;
  // Lo slug è solo [a-z0-9-]: il file non può uscire da `botsDir`.
  const target = path.join(paths.botsDir, file);
  if (existsSync(target)) throw new RegisterError('file-exists', `Esiste già una scheda «${file}»`);

  const mapping = loadMapping(paths.mappingFile);
  if (mapping.some((m) => m.locationId === input.locationId && m.environment === environment)) throw new RegisterError('location-taken', 'Questa location ha già un bot');
  if (mapping.some((m) => m.botId === def.characterId) || listBots(paths).some((b) => b.characterId === def.characterId)) {
    throw new RegisterError('character-taken', 'Questo personaggio è già un bot');
  }

  mkdirSync(paths.botsDir, { recursive: true });
  writeAtomic(target, `${JSON.stringify(def, null, 2)}\n`);
  try {
    const next = mappingSchema.parse([...mapping, { locationId: input.locationId, botId: def.characterId, environment }]);
    writeAtomic(paths.mappingFile, `${JSON.stringify(next, null, 2)}\n`);
  } catch (error: unknown) {
    rmSync(target, { force: true });
    throw error;
  }
  return { file, characterId: def.characterId };
}
