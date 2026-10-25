import type { Psyche } from '../config';
import type { MoodState, Pad, PadDelta, Relation, RelationDelta, Stance } from './types';

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Variazione massima accettata per scambio: l'AI propone, il codice limita. */
export const MAX_PAD_DELTA = 0.5;
/** Ad ogni scambio l'umore si riavvicina alla base di questa frazione: senza, la dominanza (sempre un po' positiva) satura. */
export const PULL_TO_BASELINE = 0.15;
export const MAX_RELATION_DELTA = 10;
export const MAX_FACTS = 8;
const MAX_FACT_LENGTH = 120;
const BASE_HALF_LIFE_MS = 30 * 60 * 1000;

/** Chi è più nevrotico resta agitato più a lungo e reagisce di più. */
export function moodHalfLifeMs(psyche: Psyche): number {
  return BASE_HALF_LIFE_MS * (1.5 - psyche.ocean.N / 100);
}

export function moodReactivity(psyche: Psyche): number {
  return 0.6 + psyche.ocean.N / 100;
}

export function baselinePad(psyche: Psyche): Pad {
  return { ...psyche.pad };
}

/** L'umore torna verso quello di base col passare del tempo (decadimento esponenziale). */
export function decayMood(mood: MoodState, psyche: Psyche, now: Date): MoodState {
  const base = psyche.pad;
  const elapsed = Math.max(0, now.getTime() - mood.updatedAt.getTime());
  const keep = Math.pow(0.5, elapsed / moodHalfLifeMs(psyche));
  return {
    ...mood,
    pad: {
      p: base.p + (mood.pad.p - base.p) * keep,
      a: base.a + (mood.pad.a - base.a) * keep,
      d: base.d + (mood.pad.d - base.d) * keep,
    },
    updatedAt: now,
  };
}

export function applyPadDelta(mood: MoodState, delta: PadDelta, psyche: Psyche, now: Date): MoodState {
  const k = moodReactivity(psyche);
  const base = psyche.pad;
  const step = (current: number, baseline: number, d: number): number => {
    const settled = current + (baseline - current) * PULL_TO_BASELINE;
    return clamp(settled + clamp(Number.isFinite(d) ? d : 0, -MAX_PAD_DELTA, MAX_PAD_DELTA) * k, -1, 1);
  };
  return {
    ...mood,
    pad: { p: step(mood.pad.p, base.p, delta.p), a: step(mood.pad.a, base.a, delta.a), d: step(mood.pad.d, base.d, delta.d) },
    updatedAt: now,
  };
}

export function initialMood(botId: string, psyche: Psyche, now: Date): MoodState {
  return { botId, pad: baselinePad(psyche), updatedAt: now };
}

/**
 * Il rapporto di partenza. Con un rapporto autorato valgono i suoi punteggi; altrimenti
 * quelli da sconosciuto (dalla scheda, o da Gradevolezza e Nevroticismo), spostati dalle
 * categorie a cui la persona somiglia.
 */
export function initialRelation(botId: string, playerId: string, playerName: string, psyche: Psyche, now: Date, stance?: Stance): Relation {
  const { A, N } = psyche.ocean;
  const stranger = psyche.stranger ?? {
    trust: clamp(40 + (A - 50) * 0.4 - (N - 50) * 0.15, 0, 100),
    respect: 50,
    suspicion: clamp(50 - (A - 50) * 0.3 + (N - 50) * 0.2, 0, 100),
  };
  const base = { ...stranger, ...(stance?.initial ?? {}) };
  const shift = stance?.shift ?? { trust: 0, respect: 0, suspicion: 0 };
  return {
    botId,
    playerId,
    playerName,
    trust: clamp(base.trust + shift.trust, 0, 100),
    respect: clamp(base.respect + shift.respect, 0, 100),
    suspicion: clamp(base.suspicion + shift.suspicion, 0, 100),
    interactions: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    facts: [],
  };
}

/** Sposta i punteggi (limitati per scambio). Non conta lo scambio: lo fa `recordExchange`. */
export function applyRelationDelta(rel: Relation, delta: RelationDelta): Relation {
  const step = (current: number, d: number): number =>
    clamp(current + clamp(Number.isFinite(d) ? d : 0, -MAX_RELATION_DELTA, MAX_RELATION_DELTA), 0, 100);
  return {
    ...rel,
    trust: step(rel.trust, delta.trust),
    respect: step(rel.respect, delta.respect),
    suspicion: step(rel.suspicion, delta.suspicion),
  };
}

/** Dopo la risposta pubblicata: lo scambio è avvenuto. */
export function recordExchange(rel: Relation, now: Date): Relation {
  return { ...rel, interactions: rel.interactions + 1, lastSeenAt: now };
}

const NAME_PATTERN = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .-]{1,29}$/;

/**
 * Il nome vale solo se compare davvero nel testo del giocatore: l'AI propone,
 * ma un nome allucinato non deve mai diventare "ciò che il bot sa".
 */
export function validateIntroducedName(candidate: unknown, playerText: string): string | null {
  if (typeof candidate !== 'string') return null;
  const name = candidate.trim();
  if (!NAME_PATTERN.test(name)) return null;
  return playerText.toLowerCase().includes(name.toLowerCase()) ? name : null;
}

/** Parole che contano di un fatto: minuscole, senza accenti, radice di 5 lettere (marinaio/marinai). */
function factTokens(fact: string): Set<string> {
  const words = fact.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z]{4,}/g) ?? [];
  return new Set(words.map((w) => w.slice(0, 5)));
}

/** Stesso fatto detto in modo leggermente diverso ("cerca lavoro" / "cerca lavoro al porto"). */
export function sameFact(a: string, b: string): boolean {
  const ta = factTokens(a);
  const tb = factTokens(b);
  const smaller = Math.min(ta.size, tb.size);
  if (smaller === 0) return a.toLowerCase() === b.toLowerCase();
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / smaller >= 0.6;
}

/** Un fatto nuovo sostituisce quello vecchio che dice la stessa cosa (il più recente è il più preciso). */
export function addFacts(existing: string[], incoming: unknown): string[] {
  const list = Array.isArray(incoming) ? incoming : [];
  let out = [...existing];
  for (const f of list) {
    if (typeof f !== 'string') continue;
    const fact = f.trim();
    if (fact.length < 4 || fact.length > MAX_FACT_LENGTH) continue;
    out = [...out.filter((e) => !sameFact(e, fact)), fact];
  }
  return out.slice(-MAX_FACTS);
}
