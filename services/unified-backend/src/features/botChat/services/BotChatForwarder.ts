import { logger } from '@shared/utils/logger';
import { BOT_TOKEN_TTL_SECONDS, signBotToken } from '../utils/botToken';

/**
 * Spinge al servizio AI (gateway → bot-service) ogni messaggio pubblico di una location che ha un bot.
 * Il servizio AI decide se e cosa rispondere e risponde su `/bot-api` con il token ricevuto qui. Se è spento o
 * irraggiungibile non succede nulla (il bot, semplicemente, non esiste): mai errori verso i giocatori, mai la chat bloccata.
 */

/** La riga di storia che il servizio AI usa per rispondere. */
export interface HistoryLine {
  characterId: string;
  characterName: string;
  content: string;
  position?: string | undefined;
  positionDescription?: string | undefined;
}

/** L'evento pubblicato su Redis da `BotChatEventPublisher`. */
export interface BotChatEvent {
  eventId: string;
  chatId: string;
  characterId: string;
  characterName: string;
  locationId: string;
  content: string;
  actionType: string;
  visibility: string;
  isHidden: boolean;
  position?: string | undefined;
  positionDescription?: string | undefined;
  timestamp: string;
}

export interface BotRef {
  name: string;
  characterId: string;
  locationId: string;
}

export interface EventPayload {
  environment: string;
  locationId: string;
  event: BotChatEvent;
  history: HistoryLine[];
  reply: { baseUrl: string; token: string };
}

export interface ForwarderDeps {
  environment: string;
  replyBaseUrl: string;
  secret: string;
  /** Il servizio `character-bot` è dichiarato attivo dal gateway (sonda con cache). */
  isAvailable: () => Promise<boolean>;
  /** I bot di questo ambiente (da `list` del character-bot). */
  listBots: () => Promise<BotRef[]>;
  loadHistory: (locationId: string, limit: number) => Promise<HistoryLine[]>;
  send: (payload: EventPayload) => Promise<void>;
  debounceMs?: number;
  /** Quanto vale l'elenco dei bot (il Mac è la fonte di verità). */
  directoryTtlMs?: number;
  historySize?: number;
  now?: () => number;
}

export const DEFAULT_DEBOUNCE_MS = 2_000;
const DIRECTORY_TTL_MS = 60_000;
/** Elenco non ottenuto (Mac spento): si riprova presto, ma non a ogni messaggio. */
const DIRECTORY_FAIL_TTL_MS = 10_000;
const HISTORY_SIZE = 12;
/** Un avviso uguale al massimo una volta al minuto: con il Mac spento ogni messaggio fallirebbe. */
const WARN_EVERY_MS = 60_000;

export function parseEvent(raw: string): BotChatEvent | null {
  try {
    const e = JSON.parse(raw) as Partial<BotChatEvent>;
    if (typeof e.eventId !== 'string' || typeof e.chatId !== 'string' || typeof e.characterId !== 'string' || typeof e.characterName !== 'string'
      || typeof e.locationId !== 'string' || typeof e.content !== 'string' || typeof e.actionType !== 'string' || typeof e.visibility !== 'string'
      || typeof e.timestamp !== 'string') return null;
    return {
      eventId: e.eventId, chatId: e.chatId, characterId: e.characterId, characterName: e.characterName, locationId: e.locationId,
      content: e.content, actionType: e.actionType, visibility: e.visibility, isHidden: e.isHidden === true,
      position: typeof e.position === 'string' ? e.position : undefined,
      positionDescription: typeof e.positionDescription === 'string' ? e.positionDescription : undefined,
      timestamp: e.timestamp,
    };
  } catch {
    return null;
  }
}

/** Solo ciò che tutti i presenti vedono: standard, pubblico, non nascosto. */
export const isPublicStandard = (e: BotChatEvent): boolean => e.actionType === 'standard' && e.visibility === 'public' && !e.isHidden;

export class BotChatForwarder {
  private directory: { at: number; ok: boolean; bots: BotRef[] } | null = null;
  private readonly timers = new Map<string, { timer: NodeJS.Timeout; event: BotChatEvent }>();
  private lastWarnAt = 0;
  private readonly now: () => number;

  constructor(private readonly deps: ForwarderDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Dimentica l'elenco dei bot: il prossimo messaggio lo rilegge (es. dopo aver creato un bot). */
  invalidate(): void {
    this.directory = null;
  }

  stop(): void {
    for (const { timer } of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  /** Un messaggio da Redis. Non lancia mai e non blocca: tutto il lavoro è in background. */
  handleRaw(raw: string): void {
    const event = parseEvent(raw);
    if (!event || !isPublicStandard(event)) return;
    this.consider(event).catch((error: unknown) => this.warn('Inoltro al servizio AI fallito', error));
  }

  private async consider(event: BotChatEvent): Promise<void> {
    // Il Mac spento o non dichiarato dal gateway: nessun bot, nessuna chiamata (e nessun rumore nel log).
    if (!(await this.deps.isAvailable())) return;
    const bots = await this.bots();
    const bot = bots.find((b) => b.locationId === event.locationId);
    if (!bot) return;
    // Nessun bot risponde a un bot (anche a un altro): evita eco e catene.
    if (bots.some((b) => b.characterId === event.characterId)) return;

    const pending = this.timers.get(event.locationId);
    if (pending) clearTimeout(pending.timer);
    // Una raffica diventa UNA chiamata (con l'ultimo messaggio): meno traffico sul tunnel, una sola risposta.
    const timer = setTimeout(() => {
      this.timers.delete(event.locationId);
      this.dispatch(event, bot).catch((error: unknown) => this.warn('Inoltro al servizio AI fallito', error));
    }, this.deps.debounceMs ?? DEFAULT_DEBOUNCE_MS);
    this.timers.set(event.locationId, { timer, event });
  }

  private async bots(): Promise<BotRef[]> {
    const d = this.directory;
    if (d && this.now() - d.at < (d.ok ? (this.deps.directoryTtlMs ?? DIRECTORY_TTL_MS) : DIRECTORY_FAIL_TTL_MS)) return d.bots;
    try {
      this.directory = { at: this.now(), ok: true, bots: await this.deps.listBots() };
    } catch (error: unknown) {
      this.directory = { at: this.now(), ok: false, bots: [] };
      this.warn('Elenco dei bot non disponibile', error);
    }
    return this.directory.bots;
  }

  private async dispatch(event: BotChatEvent, bot: BotRef): Promise<void> {
    const history = await this.deps.loadHistory(event.locationId, this.deps.historySize ?? HISTORY_SIZE);
    // La descrizione della posizione arriva con l'evento, non con la storia: si riattacca alla riga giusta.
    const last = history.at(-1);
    if (last && event.positionDescription && last.characterId === event.characterId && last.content === event.content) {
      last.positionDescription = event.positionDescription;
    }
    const exp = Math.floor(this.now() / 1000) + BOT_TOKEN_TTL_SECONDS;
    await this.deps.send({
      environment: this.deps.environment,
      locationId: event.locationId,
      event,
      history,
      reply: { baseUrl: this.deps.replyBaseUrl, token: signBotToken({ env: this.deps.environment, loc: event.locationId, bot: bot.characterId, exp }, this.deps.secret) },
    });
  }

  private warn(message: string, error: unknown): void {
    if (this.now() - this.lastWarnAt < WARN_EVERY_MS) return;
    this.lastWarnAt = this.now();
    logger.warn(`[BotChat] ${message}`, { error: error instanceof Error ? error.message : String(error) });
  }
}
