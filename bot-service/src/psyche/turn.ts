import type { BotConfig } from '../config';
import type { Llm } from '../ollama';
import type { TurnContext } from '../pipeline/types';
import type { HistoryLine } from '../prompt';
import { analyzeExchange } from './analyze';
import { labelFor } from './describe';
import {
  addFacts, applyPadDelta, applyRelationDelta, decayMood, initialMood, initialRelation, validateIntroducedName,
} from './dynamics';
import type { StateStore } from './store';
import type { MoodState, Relation } from './types';

export interface TurnState {
  /** Umore già decaduto fino ad adesso. */
  mood: MoodState;
  /** Cosa il bot sa dell'interlocutore (null = prima volta). */
  relation: Relation | null;
  interlocutorId: string;
  /** Nome visibile in chat: solo per il DB, mai mostrato al modello. */
  interlocutorName: string;
  /** La storia come la vede il bot: chi non si è presentato è «Straniero». */
  history: HistoryLine[];
  now: Date;
}

/** Carica umore e rapporti, e maschera i nomi che il bot non può conoscere. */
export async function loadTurnState(store: StateStore, bot: BotConfig, history: HistoryLine[], now: Date): Promise<TurnState | null> {
  const last = history.at(-1);
  if (!last || last.characterId === bot.characterId) return null;

  const speakers = [...new Set(history.filter((h) => h.characterId !== bot.characterId).map((h) => h.characterId))];
  const [storedMood, relations] = await Promise.all([
    store.getMood(bot.characterId),
    store.getRelations(bot.characterId, speakers),
  ]);

  return {
    mood: decayMood(storedMood ?? initialMood(bot.characterId, bot.psyche, now), bot.psyche, now),
    relation: relations.get(last.characterId) ?? null,
    interlocutorId: last.characterId,
    interlocutorName: last.characterName,
    history: history.map((h) =>
      h.characterId === bot.characterId ? h : { ...h, characterName: labelFor(relations.get(h.characterId) ?? null) },
    ),
    now,
  };
}

/** Testo scritto dall'interlocutore dopo l'ultima battuta del bot: dove può essersi presentato. */
function playerTextSinceLastReply(history: HistoryLine[], botId: string, playerId: string): string {
  const lastOwn = history.findLastIndex((h) => h.characterId === botId);
  return history
    .slice(lastOwn + 1)
    .filter((h) => h.characterId === playerId)
    .map((h) => h.content)
    .join(' ');
}

/**
 * Dopo una risposta pubblicata: l'AI propone come cambiano umore e rapporto, il codice
 * limita e verifica. La parte deterministica (conteggio, data, decadimento) si salva
 * sempre, anche se l'analisi AI fallisce.
 */
export async function commitTurn(
  store: StateStore,
  llm: Llm,
  ctx: TurnContext,
  state: TurnState,
  rawHistory: HistoryLine[],
  reply: string,
): Promise<void> {
  const { bot } = ctx;
  const analysis = await analyzeExchange(llm, ctx, reply);

  const zero = { p: 0, a: 0, d: 0 };
  await store.saveMood(applyPadDelta(state.mood, analysis?.pad ?? zero, bot.psyche, state.now));

  const base = state.relation ?? initialRelation(bot.characterId, state.interlocutorId, state.interlocutorName, bot.psyche, state.now);
  let rel: Relation = {
    ...applyRelationDelta(base, analysis?.relation ?? { trust: 0, respect: 0, suspicion: 0 }, state.now),
    playerName: state.interlocutorName,
  };

  if (analysis) {
    if (!rel.knownName) {
      const name = validateIntroducedName(
        analysis.introducedName,
        playerTextSinceLastReply(rawHistory, bot.characterId, state.interlocutorId),
      );
      if (name) rel = { ...rel, knownName: name };
    }
    rel = { ...rel, facts: addFacts(rel.facts, analysis.facts) };
  }

  await store.saveRelation(rel);
}
