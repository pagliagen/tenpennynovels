import { findAnachronisms } from '@features/editorial/api';
import { draftSchema, draftText, botSheet, type BotDraft } from '../utils/draft';

/**
 * Elenco, generazione e creazione dei bot dal gestionale. Il backend orchestra: il modello e i file stanno in
 * `bot-service` (azioni `list`, `design`, `register` del character-bot, via gateway), il personaggio sta nel DB di gioco.
 * Strumento da sviluppo: in produzione il flag è spento e il bot non gira.
 */

export class BotAdminError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export interface LocationInfo {
  _id: string;
  name: string;
  quartiere: string | null;
  district: string | null;
  description: string;
  tagLabels: string[];
  positionNames: string[];
  /** Solo le location di livello `location` hanno una chat dove un bot può rispondere. */
  hasChat: boolean;
}

export interface BotListing {
  name: string;
  characterId: string;
  environment: string;
  locationId: string | null;
  file: string;
  active: boolean;
}

export interface BotAdminDeps {
  /** L'ambiente di questo backend: vede solo i bot creati qui e li crea con questa etichetta. */
  environment: string;
  /** Un'azione del character-bot via gateway. */
  call: (action: 'list' | 'design' | 'register', body: unknown, timeoutMs?: number) => Promise<unknown>;
  loadLocation: (locationId: string) => Promise<LocationInfo | null>;
  locationNames: (ids: string[]) => Promise<Map<string, string>>;
  characterStatuses: (ids: string[]) => Promise<Map<string, string>>;
  systemUserExists: () => Promise<boolean>;
  nameInUse: (name: string) => Promise<boolean>;
  createCharacter: (fields: BotDraft['character']) => Promise<string>;
  deleteCharacter: (characterId: string) => Promise<void>;
}

/** Una scheda completa dura da 15 s a più di un minuto (fino a 2 tentativi): si aspetta, ma non all'infinito. */
export const DESIGN_TIMEOUT_MS = 180_000;
export const MIN_DESCRIPTION_CHARS = 20;

export interface DraftCheck {
  code: string;
  ok: boolean;
  detail?: string;
}

export interface DesignOutcome {
  draft: BotDraft | null;
  checks: DraftCheck[];
  attempts: number;
  ms: number;
}

async function listRaw(deps: BotAdminDeps): Promise<{ bots: BotListing[]; hiddenOtherEnvironments: number }> {
  const body = (await deps.call('list', { environment: deps.environment })) as { bots?: unknown; hiddenOtherEnvironments?: unknown };
  if (!Array.isArray(body.bots)) throw new BotAdminError(502, 'BAD_RESPONSE', 'Risposta del servizio AI non valida.');
  return { bots: body.bots as BotListing[], hiddenOtherEnvironments: typeof body.hiddenOtherEnvironments === 'number' ? body.hiddenOtherEnvironments : 0 };
}

export interface BotsOverview {
  bots: (BotListing & { locationName: string | null; playerStatus: string | null })[];
  /** Bot di altri ambienti (il loro personaggio non è in questo database): non si mostrano, si contano. */
  hiddenOtherEnvironments: number;
}

export async function listBots(deps: BotAdminDeps): Promise<BotsOverview> {
  const { bots, hiddenOtherEnvironments } = await listRaw(deps);
  const [names, statuses] = await Promise.all([
    deps.locationNames(bots.map((b) => b.locationId).filter((id): id is string => !!id)),
    deps.characterStatuses(bots.map((b) => b.characterId)),
  ]);
  return {
    hiddenOtherEnvironments,
    bots: bots.map((b) => ({
      ...b,
      locationName: b.locationId ? names.get(b.locationId) ?? null : null,
      playerStatus: statuses.get(b.characterId) ?? null,
    })),
  };
}

async function requireFreeLocation(deps: BotAdminDeps, locationId: string): Promise<{ location: LocationInfo; existing: BotListing[] }> {
  const location = await deps.loadLocation(locationId);
  if (!location) throw new BotAdminError(404, 'NOT_FOUND', 'Location non trovata');
  if (!location.hasChat) throw new BotAdminError(422, 'INVALID_LOCATION', 'Un bot risponde nella chat di una location: scegli un luogo specifico, non un quartiere o un distretto.');
  // L'elenco è già solo di questo ambiente: la location è libera se non c'è un bot di QUESTO ambiente.
  const { bots: existing } = await listRaw(deps);
  if (existing.some((b) => b.locationId === locationId)) throw new BotAdminError(409, 'LOCATION_TAKEN', 'Questa location ha già un bot.');
  return { location, existing };
}

export interface PreparedDesign {
  request: { description: string; location: Omit<LocationInfo, '_id' | 'hasChat' | 'tagLabels'> & { tags: string[] }; existingNames: string[] };
}

/** Controlli prima di spendere un minuto di modello: se falliscono si risponde con un errore normale, non con un flusso. */
export async function prepareDesign(deps: BotAdminDeps, input: { locationId: string; description: string }): Promise<PreparedDesign> {
  const description = input.description.trim();
  if (description.length < MIN_DESCRIPTION_CHARS) {
    throw new BotAdminError(422, 'INSUFFICIENT_INPUT', 'Descrivi il bot in almeno una frase (chi è, che lavoro fa, che carattere ha): l\'AI parte da lì.');
  }
  const { location, existing } = await requireFreeLocation(deps, input.locationId);
  return {
    request: {
      description,
      location: { name: location.name, quartiere: location.quartiere, district: location.district, tags: location.tagLabels, description: location.description, positionNames: location.positionNames },
      // Solo i nomi dei bot: i nomi dei giocatori non escono dal server. L'unicità sul DB si controlla qui sotto.
      existingNames: existing.map((b) => b.name),
    },
  };
}

/** Genera la bozza e aggiunge i controlli che solo il backend può fare (anacronismi, nome già nel gioco). */
export async function runDesign(deps: BotAdminDeps, prepared: PreparedDesign): Promise<DesignOutcome> {
  const { location, ...rest } = prepared.request;
  const body = { ...rest, location: { name: location.name, quartiere: location.quartiere, district: location.district, tags: location.tags, description: location.description, positions: location.positionNames } };
  const result = (await deps.call('design', body, DESIGN_TIMEOUT_MS)) as { draft?: unknown; checks?: unknown; attempts?: unknown; ms?: unknown };
  if (!Array.isArray(result.checks) || typeof result.attempts !== 'number') throw new BotAdminError(502, 'BAD_RESPONSE', 'Risposta del servizio AI non valida.');

  const checks = [...(result.checks as DraftCheck[])];
  const parsed = draftSchema.safeParse(result.draft);
  const draft = parsed.success ? parsed.data : null;
  if (draft) {
    const hits = [...new Set(findAnachronisms(draftText(draft)).map((h) => h.word))];
    checks.push({ code: 'anachronism', ok: hits.length === 0, ...(hits.length ? { detail: hits.join(', ') } : {}) });
    const taken = await deps.nameInUse(draft.character.name);
    checks.push({ code: 'name-in-game', ok: !taken, ...(taken ? { detail: `«${draft.character.name}» è già il nome di un personaggio` } : {}) });
  }
  return { draft, checks, attempts: result.attempts, ms: typeof result.ms === 'number' ? result.ms : 0 };
}

export interface CreatedBot {
  characterId: string;
  environment: string;
  file: string;
  /** false = scheda e personaggio creati, ma il servizio non si è ricaricato: il bot parte al prossimo riavvio. */
  reloaded: boolean;
}

/**
 * Crea il bot: personaggio nel game, poi scheda e mapping in bot-service. Se la seconda parte fallisce il personaggio
 * appena creato viene tolto (compensazione); un crash fra le due lascerebbe un personaggio orfano, visibile nel gestionale.
 */
export async function createBot(deps: BotAdminDeps, input: { locationId: string; draft: unknown }): Promise<CreatedBot> {
  const parsed = draftSchema.safeParse(input.draft);
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new BotAdminError(400, 'VALIDATION_ERROR', `Scheda non valida (${detail})`);
  }
  const draft = parsed.data;

  // Senza l'utente di sistema (assente in produzione) non si crea nulla: seconda difesa oltre al flag spento.
  if (!(await deps.systemUserExists())) {
    throw new BotAdminError(409, 'NO_SYSTEM_USER', 'Manca l\'utente di sistema dei bot in questo ambiente: i bot si creano solo dove il bot è previsto.');
  }
  await requireFreeLocation(deps, input.locationId);
  if (await deps.nameInUse(draft.character.name)) {
    throw new BotAdminError(409, 'NAME_TAKEN', `«${draft.character.name}» è già il nome di un personaggio: scegline un altro.`);
  }

  const characterId = await deps.createCharacter(draft.character);
  try {
    const registered = (await deps.call('register', { locationId: input.locationId, environment: deps.environment, sheet: botSheet(draft, characterId) })) as { file?: unknown; reloaded?: unknown };
    return { characterId, environment: deps.environment, file: typeof registered.file === 'string' ? registered.file : '', reloaded: registered.reloaded !== false };
  } catch (error: unknown) {
    await deps.deleteCharacter(characterId).catch(() => undefined);
    throw error;
  }
}
