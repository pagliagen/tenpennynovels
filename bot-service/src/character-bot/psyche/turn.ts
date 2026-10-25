import type { BotConfig } from '../config';
import type { Llm } from '../../shared/ollama';
import type { TurnContext } from '../pipeline/types';
import type { HistoryLine } from '../prompt';
import type { Appraisal } from './appraise';
import { outcomeOf } from './events';
import { labelFor } from './describe';
import {
  addFacts, applyPadDelta, applyRelationDelta, decayMood, initialMood, initialRelation, recordExchange, validateIntroducedName,
} from './dynamics';
import { SUMMARY_EVERY, updateSummary } from './memory';
import { effectivePad, resolveStance } from './stance';
import type { StateStore } from './store';
import type { Appearance, MoodState, Relation, Stance } from './types';

/** Come il bot "vede" una persona: dal backend (campi pubblici della scheda), null se non raggiungibile. */
export type AppearanceLookup = (characterId: string) => Promise<Appearance | null>;

export interface TurnState {
  /** Umore di fondo, già decaduto fino ad adesso. */
  mood: MoodState;
  /** Umore con cui parla a questa persona: di fondo + effetto di lei/lui. */
  effectiveMood: MoodState['pad'];
  /** Cosa il bot sa dell'interlocutore (null = prima volta). */
  relation: Relation | null;
  stance: Stance;
  appearance: Appearance | null;
  interlocutorId: string;
  /** Nome visibile in chat: solo per il DB, mai mostrato al modello se non lo conosce. */
  interlocutorName: string;
  /** Come il bot chiama l'interlocutore, se lo conosce. */
  knownName?: string;
  /** La storia come la vede il bot: chi non si è presentato è «Straniero». */
  history: HistoryLine[];
  /** Altri presenti con cui il bot ha un rapporto, già in frasi. */
  others: string[];
  now: Date;
}

/** Carica umore, rapporti e aspetto, e maschera i nomi che il bot non può conoscere. */
export async function loadTurnState(
  store: StateStore,
  bot: BotConfig,
  history: HistoryLine[],
  now: Date,
  lookup: AppearanceLookup = async () => null,
): Promise<TurnState | null> {
  const last = history.at(-1);
  if (!last || last.characterId === bot.characterId) return null;

  const names = new Map<string, string>();
  for (const h of history) if (h.characterId !== bot.characterId) names.set(h.characterId, h.characterName);
  const speakers = [...names.keys()];

  const [storedMood, relations, looks] = await Promise.all([
    store.getMood(bot.characterId),
    store.getRelations(bot.characterId, speakers),
    Promise.all(speakers.map(async (id) => [id, await lookup(id).catch(() => null)] as const)),
  ]);
  const appearances = new Map(looks);
  const stances = new Map(speakers.map((id) => [id, resolveStance(bot, id, appearances.get(id) ?? null)]));

  const labelOf = (id: string): string => labelFor(relations.get(id) ?? null, stances.get(id), names.get(id));
  const mood = decayMood(storedMood ?? initialMood(bot.characterId, bot.psyche, now), bot.psyche, now);
  const stance = stances.get(last.characterId)!;
  const label = labelOf(last.characterId);

  const others = speakers
    .filter((id) => id !== last.characterId)
    .flatMap((id) => {
      const st = stances.get(id)!;
      return st.authored ? [`${labelOf(id)} è qui${st.label ? `: per te è ${st.label}` : ''}.`] : [];
    });

  return {
    mood,
    effectiveMood: effectivePad(mood.pad, stance),
    relation: relations.get(last.characterId) ?? null,
    stance,
    appearance: appearances.get(last.characterId) ?? null,
    interlocutorId: last.characterId,
    interlocutorName: last.characterName,
    ...(label !== 'Straniero' ? { knownName: label } : {}),
    history: history.map((h) => (h.characterId === bot.characterId ? h : { ...h, characterName: labelOf(h.characterId) })),
    others,
    now,
  };
}

/** Testo scritto dall'interlocutore dopo l'ultima battuta del bot: ciò a cui sta per rispondere. */
export function playerTextSinceLastReply(history: HistoryLine[], botId: string, playerId: string): string {
  const lastOwn = history.findLastIndex((h) => h.characterId === botId);
  return history
    .slice(lastOwn + 1)
    .filter((h) => h.characterId === playerId)
    .map((h) => h.content)
    .join(' ');
}

/**
 * PRIMA della risposta: ciò che l'altro ha appena fatto cambia umore e rapporto, e
 * se si è presentato il bot lo sa già mentre risponde. L'AI classifica (eventi), il
 * codice calcola e limita. Salva: lo stato aggiornato si ricarica con `loadTurnState`.
 * Con `appraisal` null (analisi fallita) l'umore si limita a decadere.
 */
export async function applyAppraisal(
  store: StateStore,
  bot: BotConfig,
  state: TurnState,
  appraisal: Appraisal | null,
  playerText: string,
): Promise<void> {
  const outcome = appraisal ? outcomeOf(appraisal.events, state.relation, bot.psyche) : null;
  await store.saveMood(applyPadDelta(state.mood, outcome?.pad ?? { p: 0, a: 0, d: 0 }, bot.psyche, state.now));

  const base = state.relation ?? initialRelation(bot.characterId, state.interlocutorId, state.interlocutorName, bot.psyche, state.now, state.stance);
  let rel: Relation = { ...applyRelationDelta(base, outcome?.relation ?? { trust: 0, respect: 0, suspicion: 0 }), playerName: state.interlocutorName };

  if (appraisal) {
    if (!rel.knownName && !state.stance.knowsName) {
      const name = validateIntroducedName(appraisal.introducedName, playerText);
      if (name) rel = { ...rel, knownName: name };
    }
    rel = { ...rel, facts: addFacts(rel.facts, appraisal.facts), ...(outcome?.memory ? { lastEvent: outcome.memory } : {}) };
  }
  await store.saveRelation(rel);
}

/**
 * Dopo la risposta pubblicata: lo scambio è avvenuto (conteggio, data) e ogni
 * `SUMMARY_EVERY` scambi si aggiorna il riassunto del rapporto. Nello stesso job della coda.
 */
export async function finishTurn(store: StateStore, llm: Llm, ctx: TurnContext, state: TurnState, reply: string): Promise<void> {
  const [stored] = [...(await store.getRelations(ctx.bot.characterId, [state.interlocutorId])).values()];
  const base = stored ?? initialRelation(ctx.bot.characterId, state.interlocutorId, state.interlocutorName, ctx.bot.psyche, state.now, state.stance);
  let rel = recordExchange(base, state.now);

  if (rel.interactions % SUMMARY_EVERY === 0) {
    const summary = await updateSummary(llm, ctx, rel.summary, reply);
    if (summary) rel = { ...rel, summary };
  }
  await store.saveRelation(rel);
}
