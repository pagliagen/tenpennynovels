import { logger } from './logger';
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

export class BackendClient {
  constructor(private readonly baseUrl: string, private readonly secret: string) {}

  /** Pubblica la risposta nella chat. Ritenta una volta su errore di rete o 5xx. */
  async postMessage(params: { characterId: string; locationId: string; content: string; position?: string }): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(new URL('/internal/bot-chat/messages', this.baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Bot-Service-Secret': this.secret },
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

  private readonly appearances = new Map<string, { at: number; value: Appearance | null }>();

  /**
   * Come appare un personaggio (solo campi pubblici della scheda, decisi dal backend).
   * In cache: l'aspetto cambia di rado e il backend limita le richieste. Se il backend
   * non risponde il bot resta cieco, non si ferma.
   */
  async getAppearance(characterId: string): Promise<Appearance | null> {
    const cached = this.appearances.get(characterId);
    if (cached && Date.now() - cached.at < APPEARANCE_TTL_MS) return cached.value;

    let value: Appearance | null = null;
    try {
      const response = await fetch(new URL(`/internal/bot-chat/characters/${encodeURIComponent(characterId)}`, this.baseUrl), {
        headers: { 'X-Bot-Service-Secret': this.secret },
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
    this.appearances.set(characterId, { at: Date.now(), value });
    return value;
  }

  private environment: { at: number; value: BotEnvironment } | null = null;

  /**
   * Il meteo che i giocatori vedono in sidebar. Se il backend non risponde il bot NON lo
   * indovina: ritorna null e non lo cita (un meteo sbagliato è peggio di nessun meteo).
   */
  async getEnvironment(): Promise<BotEnvironment | null> {
    if (this.environment && Date.now() - this.environment.at < ENVIRONMENT_TTL_MS) return this.environment.value;
    try {
      const response = await fetch(new URL('/internal/bot-chat/environment', this.baseUrl), {
        headers: { 'X-Bot-Service-Secret': this.secret },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn('Meteo non disponibile', { status: response.status });
        return null;
      }
      const body = (await response.json()) as { data?: BotEnvironment };
      if (!body.data?.description || !Array.isArray(body.data.words)) return null;
      this.environment = { at: Date.now(), value: body.data };
      return body.data;
    } catch (error: unknown) {
      logger.warn('Backend non raggiungibile per il meteo', { error: String(error) });
      return null;
    }
  }

  private tags: { at: number; value: LocationTagOption[] } | null = null;

  /** L'elenco chiuso dei tag dei luoghi (con cosa significano). Senza, il bot non sa riconoscere le richieste di luoghi. */
  async getLocationTags(): Promise<LocationTagOption[]> {
    if (this.tags && Date.now() - this.tags.at < TAGS_TTL_MS) return this.tags.value;
    try {
      const response = await fetch(new URL('/internal/bot-chat/knowledge/tags', this.baseUrl), {
        headers: { 'X-Bot-Service-Secret': this.secret },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn('Tag dei luoghi non disponibili', { status: response.status });
        return [];
      }
      const body = (await response.json()) as { data?: LocationTagOption[] };
      const value = Array.isArray(body.data) ? body.data : [];
      if (value.length > 0) this.tags = { at: Date.now(), value };
      return value;
    } catch (error: unknown) {
      logger.warn('Backend non raggiungibile per i tag dei luoghi', { error: String(error) });
      return [];
    }
  }

  /** Luoghi e ambientazione per rispondere a una domanda. null se il backend non risponde: il bot ammette di non sapere. */
  async getKnowledge(params: { tags: string[]; placeName?: string; query?: string; fromLocationId: string; knownDistricts: string[] }): Promise<BotKnowledge | null> {
    try {
      const response = await fetch(new URL('/internal/bot-chat/knowledge', this.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bot-Service-Secret': this.secret },
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
