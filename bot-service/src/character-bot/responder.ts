import type PQueue from 'p-queue';
import type { BotConfig } from './config';
import type { Llm } from '../shared/ollama';
import type { BackendClient } from './backendClient';
import type { HistoryLine } from './prompt';
import { weatherLines, type BotEnvironment } from './environment';
import { hasRequest, knowledgeLines, knowledgeVocabulary, NO_REQUEST } from './knowledge';
import { generateReply } from './pipeline';
import type { TurnContext } from './pipeline/types';
import { buildPsycheLines } from './psyche/blocks';
import type { StateStore } from './psyche/store';
import { appraiseIncoming } from './psyche/appraise';
import { applyAppraisal, finishTurn, loadTurnState, playerTextSinceLastReply, type TurnState } from './psyche/turn';
import { logger } from '../shared/logger';

/** Quante battute precedenti del bot si confrontano per rilevare le ripetizioni. */
const COMPARE_LAST_OWN = 4;

/** Le ultime battute pubbliche di una location (Redis in servizio, finto negli scenari). */
export interface HistorySource {
  recent(locationId: string, size: number): Promise<HistoryLine[]>;
}

interface Deps {
  history: HistorySource;
  ollama: Llm;
  backend: Pick<BackendClient, 'postMessage'> & Partial<Pick<BackendClient, 'getAppearance' | 'getEnvironment' | 'getLocationTags' | 'getKnowledge'>>;
  /** Umore del bot e rapporto con ogni giocatore. */
  store: StateStore;
  /** Coda condivisa a concurrency 1: Ollama locale elabora una richiesta alla volta. */
  queue: PQueue;
  now?: () => number;
}

/**
 * Un bot attivo in una location. `notify()` va chiamato a ogni messaggio che
 * lo riguarda: raccoglie le raffiche (debounce), rispetta il cooldown e solo
 * allora mette in coda UNA generazione che legge la storia più recente.
 */
export class BotResponder {
  private timer: NodeJS.Timeout | null = null;
  private lastReplyAt = 0;
  private readonly now: () => number;

  constructor(private readonly bot: BotConfig, private readonly deps: Deps) {
    this.now = deps.now ?? Date.now;
  }

  notify(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fire(), this.bot.debounceMs);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private fire(): void {
    this.timer = null;
    const wait = this.lastReplyAt + this.bot.cooldownMs - this.now();
    if (wait > 0) {
      this.timer = setTimeout(() => this.fire(), wait);
      return;
    }
    this.deps.queue.add(() => this.reply()).catch((error: unknown) => {
      logger.error('Risposta fallita', { bot: this.bot.name, error: String(error) });
    });
  }

  /** Una risposta adesso, senza debounce né cooldown (anche per gli scenari di prova). */
  async reply(): Promise<string | null> {
    const rawHistory = await this.deps.history.recent(this.bot.locationId, this.bot.historySize);
    const lookup = (id: string) => this.deps.backend.getAppearance?.(id) ?? Promise.resolve(null);
    const now = new Date(this.now());
    const environment = (await this.deps.backend.getEnvironment?.()) ?? null;
    const initial = await loadTurnState(this.deps.store, this.bot, rawHistory, now, lookup);
    // Storia vuota o ultima battuta già nostra: niente a cui rispondere.
    if (!initial) return null;
    const last = rawHistory.at(-1)!;

    // Prima si reagisce a ciò che l'altro ha fatto (umore, rapporto, nome detto), poi si risponde:
    // chi viene insultato risponde già arrabbiato, chi si presenta viene chiamato per nome.
    const playerText = playerTextSinceLastReply(rawHistory, this.bot.characterId, initial.interlocutorId);
    const locationTags = (await this.deps.backend.getLocationTags?.()) ?? [];
    const appraisal = await appraiseIncoming(this.deps.ollama, this.contextFor(rawHistory, initial, environment), playerText, locationTags);
    await applyAppraisal(this.deps.store, this.bot, initial, appraisal, playerText);
    const state = (await loadTurnState(this.deps.store, this.bot, rawHistory, now, lookup))!;

    // Se chiede di luoghi o di ambientazione si interroga il mondo, invece di lasciare che il modello inventi.
    const request = appraisal?.infoRequest ?? NO_REQUEST;
    const knowledge = hasRequest(request)
      ? (await this.deps.backend.getKnowledge?.({
          tags: request.tags,
          ...(request.placeName ? { placeName: request.placeName } : {}),
          ...(request.needsLore ? { query: playerText.slice(0, 200) } : {}),
          fromLocationId: this.bot.locationId,
          knownDistricts: this.bot.knows,
        })) ?? null
      : null;
    const world = { lines: knowledgeLines(request, knowledge), vocabulary: knowledgeVocabulary(knowledge) };

    const ctx = this.contextFor(rawHistory, state, environment, world);

    const result = await generateReply(this.deps.ollama, ctx);
    if (!result) {
      logger.warn('Il modello ha restituito una risposta vuota', { bot: this.bot.name });
      return null;
    }
    logger.info('Pipeline completata', {
      bot: this.bot.name,
      steps: result.trace.map((t) => `${t.step}:${t.ms}ms`).join(' '),
      issues: result.issues.map((i) => i.type),
    });
    if (result.issues.length > 0) {
      logger.warn('Pubblico la migliore battuta disponibile, ancora con difetti', { bot: this.bot.name, issues: result.issues.map((i) => i.type) });
    }
    const content = result.content;

    const posted = await this.deps.backend.postMessage({
      characterId: this.bot.characterId,
      locationId: this.bot.locationId,
      content,
      // Stesso tag del giocatore a cui risponde: la risposta sta "nello stesso punto".
      position: last.position,
    });
    if (posted) {
      this.lastReplyAt = this.now();
      logger.info('Risposta pubblicata', { bot: this.bot.name, chars: content.length });
      // Nello stesso job della coda: il messaggio successivo vede lo stato già aggiornato.
      try {
        await finishTurn(this.deps.store, this.deps.ollama, ctx, state, content);
      } catch (error: unknown) {
        logger.error('Aggiornamento di umore e rapporto fallito', { bot: this.bot.name, error: String(error) });
      }
    } else {
      logger.error('Risposta generata ma non pubblicata', { bot: this.bot.name });
    }
    return posted ? content : null;
  }

  private contextFor(rawHistory: HistoryLine[], state: TurnState, env: BotEnvironment | null, world: { lines: string[]; vocabulary: string[] } = { lines: [], vocabulary: [] }): TurnContext {
    const lastPlayer = rawHistory.at(-1);
    const weather = weatherLines(env, {
      lastPlayerText: playerTextSinceLastReply(rawHistory, this.bot.characterId, state.interlocutorId),
      position: lastPlayer?.position,
      ownLines: rawHistory.filter((h) => h.characterId === this.bot.characterId).map((h) => h.content),
    });
    const psycheLines = buildPsycheLines({
      psyche: this.bot.psyche,
      mood: state.effectiveMood,
      relation: state.relation,
      stance: state.stance,
      appearance: state.appearance,
      ...(state.knownName ? { name: state.knownName } : {}),
      now: state.now,
      others: state.others,
      environment: weather,
      knowledge: world.lines,
    });
    return {
      bot: this.bot,
      history: state.history,
      previousOwn: rawHistory
        .filter((h) => h.characterId === this.bot.characterId)
        .slice(-COMPARE_LAST_OWN)
        .map((h) => h.content),
      // Nomi e parole valgono solo se il modello li ha visti (persona, chat, rapporto, luoghi e meteo di
      // questo turno): tutto il resto, se lo scrive, è inventato. Non le righe di prompt intere: contengono
      // anche i divieti («niente neve») che altrimenti renderebbero lecite proprio le parole vietate.
      knownText: [
        this.bot.persona, this.bot.name, ...(weather.length > 0 && env ? env.words : []), ...world.vocabulary,
        state.stance.label ?? '', state.stance.backstory ?? '', ...state.stance.hints, ...state.others,
        ...rawHistory.flatMap((h) => [h.characterName, h.content]),
      ].join(' '),
      psyche: this.bot.psyche,
      mood: state.effectiveMood,
      relation: state.relation,
      genderKnown: !!state.appearance?.gender,
      psycheLines,
      ...(state.knownName ? { otherName: state.knownName } : {}),
    };
  }
}
