import { logger } from '../shared/logger';
import type { Appearance } from './psyche/types';
import type { BotEnvironment } from './environment';
import type { BotKnowledge, LocationTagOption } from './knowledge';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;
const APPEARANCE_TTL_MS = 60 * 60 * 1000;
/** Il meteo cambia di rado ma la sidebar si aggiorna ogni pochi minuti: cache corta, il bot non deve restare indietro. */
const ENVIRONMENT_TTL_MS = 60 * 1000;
/** I tag cambiano solo con un deploy. */
const TAGS_TTL_MS = 60 * 60 * 1000;
/** La ricerca nei documenti passa dal worker di embedding: può essere lenta. */
const KNOWLEDGE_TIMEOUT_MS = 20_000;

/**
 * Cache condivise fra i client: il client si costruisce PER EVENTO (l'indirizzo e il token arrivano con l'evento), ma
 * l'aspetto, il meteo e i tag restano validi fra un evento e l'altro. Le chiavi includono l'indirizzo: due ambienti non si mescolano.
 */
const appearanceCache = new Map<string, { at: number; value: Appearance | null }>();
const environmentCache = new Map<string, { at: number; value: BotEnvironment }>();
const tagsCache = new Map<string, { at: number; value: LocationTagOption[] }>();

/** Il client del gioco. `baseUrl` e `token` arrivano con l'evento (`reply`): il servizio non li conserva né li conosce in anticipo. */
export class BackendClient {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  /** Pubblica la risposta nella chat. Ritenta una volta su errore di rete o 5xx. */
  async postMessage(params: { characterId: string; locationId: string; content: string; position?: string }): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(new URL('/bot-api/messages', this.baseUrl), {
          method: 'POST',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return true;

        const body = (await response.text()).slice(0, 200);
        logger.warn('Backend ha rifiutato il messaggio', { status: response.status, body, attempt });
        if (response.status < 500) return false;
      } catch (error: unknown) {
        logger.warn('Backend non raggiungibile', { error: String(error), attempt });
      }
    }
    return false;
  }

  /**
   * Come appare un personaggio (solo campi pubblici della scheda, decisi dal backend).
   * In cache: l'aspetto cambia di rado e il backend limita le richieste. Se il backend
   * non risponde il bot resta cieco, non si ferma.
   */
  async getAppearance(characterId: string): Promise<Appearance | null> {
    const cacheKey = `${this.baseUrl}|${characterId}`;
    const cached = appearanceCache.get(cacheKey);
    if (cached && Date.now() - cached.at < APPEARANCE_TTL_MS) return cached.value;

    let value: Appearance | null = null;
    try {
      const response = await fetch(new URL(`/bot-api/characters/${encodeURIComponent(characterId)}`, this.baseUrl), {
        headers: this.headers(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        const body = (await response.json()) as { data?: Appearance & { _id?: string } };
        if (body.data) {
          const { _id: _ignored, ...rest } = body.data;
          value = rest;
        }
      } else {
        logger.warn('Aspetto non disponibile', { status: response.status, characterId });
      }
    } catch (error: unknown) {
      logger.warn('Backend non raggiungibile per l\'aspetto', { error: String(error), characterId });
      return null; // non in cache: riprova al prossimo messaggio
    }
    appearanceCache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  /**
   * Il meteo che i giocatori vedono in sidebar. Se il backend non risponde il bot NON lo
   * indovina: ritorna null e non lo cita (un meteo sbagliato è peggio di nessun meteo).
   */
  async getEnvironment(): Promise<BotEnvironment | null> {
    const cachedEnvironment = environmentCache.get(this.baseUrl);
    if (cachedEnvironment && Date.now() - cachedEnvironment.at < ENVIRONMENT_TTL_MS) return cachedEnvironment.value;
    try {
      const response = await fetch(new URL('/bot-api/environment', this.baseUrl), {
        headers: this.headers(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn('Meteo non disponibile', { status: response.status });
        return null;
      }
      const body = (await response.json()) as { data?: BotEnvironment };
      if (!body.data?.description || !Array.isArray(body.data.words)) return null;
      environmentCache.set(this.baseUrl, { at: Date.now(), value: body.data });
      return body.data;
    } catch (error: unknown) {
      logger.warn('Backend non raggiungibile per il meteo', { error: String(error) });
      return null;
    }
  }

  /** L'elenco chiuso dei tag dei luoghi (con cosa significano). Senza, il bot non sa riconoscere le richieste di luoghi. */
  async getLocationTags(): Promise<LocationTagOption[]> {
    const cachedTags = tagsCache.get(this.baseUrl);
    if (cachedTags && Date.now() - cachedTags.at < TAGS_TTL_MS) return cachedTags.value;
    try {
      const response = await fetch(new URL('/bot-api/knowledge/tags', this.baseUrl), {
        headers: this.headers(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn('Tag dei luoghi non disponibili', { status: response.status });
        return [];
      }
      const body = (await response.json()) as { data?: LocationTagOption[] };
      const value = Array.isArray(body.data) ? body.data : [];
      if (value.length > 0) tagsCache.set(this.baseUrl, { at: Date.now(), value });
      return value;
    } catch (error: unknown) {
      logger.warn('Backend non raggiungibile per i tag dei luoghi', { error: String(error) });
      return [];
    }
  }

  /** Luoghi e ambientazione per rispondere a una domanda. null se il backend non risponde: il bot ammette di non sapere. */
  async getKnowledge(params: { tags: string[]; placeName?: string; query?: string; fromLocationId: string; knownDistricts: string[] }): Promise<BotKnowledge | null> {
    try {
      const response = await fetch(new URL('/bot-api/knowledge', this.baseUrl), {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(KNOWLEDGE_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn('Conoscenza del mondo non disponibile', { status: response.status });
        return null;
      }
      const body = (await response.json()) as { data?: BotKnowledge };
      return body.data && Array.isArray(body.data.places) && body.data.lore ? body.data : null;
    } catch (error: unknown) {
      logger.warn('Backend non raggiungibile per la conoscenza del mondo', { error: String(error) });
      return null;
    }
  }
}
