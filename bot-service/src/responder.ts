import type PQueue from 'p-queue';
import type { BotConfig } from './config';
import type { History } from './history';
import type { Llm } from './ollama';
import type { BackendClient } from './backendClient';
import { generateReply } from './pipeline';
import type { TurnContext } from './pipeline/types';
import { buildPsycheLines } from './psyche/blocks';
import type { StateStore } from './psyche/store';
import { commitTurn, loadTurnState } from './psyche/turn';
import { logger } from './logger';

/** Quante battute precedenti del bot si confrontano per rilevare le ripetizioni. */
const COMPARE_LAST_OWN = 4;

interface Deps {
  history: History;
  ollama: Llm;
  backend: Pick<BackendClient, 'postMessage'>;
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

  private async reply(): Promise<void> {
    const rawHistory = await this.deps.history.recent(this.bot.locationId, this.bot.historySize);
    const state = await loadTurnState(this.deps.store, this.bot, rawHistory, new Date(this.now()));
    // Storia vuota o ultima battuta già nostra: niente a cui rispondere.
    if (!state) return;
    const last = rawHistory.at(-1)!;

    const ctx: TurnContext = {
      bot: this.bot,
      history: state.history,
      previousOwn: rawHistory
        .filter((h) => h.characterId === this.bot.characterId)
        .slice(-COMPARE_LAST_OWN)
        .map((h) => h.content),
      knownText: [this.bot.persona, this.bot.name, ...rawHistory.flatMap((h) => [h.characterName, h.content])].join(' '),
      psyche: this.bot.psyche,
      mood: state.mood.pad,
      relation: state.relation,
      psycheLines: buildPsycheLines(this.bot.psyche, state.mood.pad, state.relation, state.now),
      ...(state.relation?.knownName ? { otherName: state.relation.knownName } : {}),
    };

    const result = await generateReply(this.deps.ollama, ctx);
    if (!result) {
      logger.warn('Il modello ha restituito una risposta vuota', { bot: this.bot.name });
      return;
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
        await commitTurn(this.deps.store, this.deps.ollama, ctx, state, rawHistory, content);
      } catch (error: unknown) {
        logger.error('Aggiornamento di umore e rapporto fallito', { bot: this.bot.name, error: String(error) });
      }
    } else {
      logger.error('Risposta generata ma non pubblicata', { bot: this.bot.name });
    }
  }
}
