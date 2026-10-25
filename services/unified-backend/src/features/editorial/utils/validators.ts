import { mentionsGameMeta } from '@features/documenti/api';
import { findAnachronisms } from './anachronisms';

/**
 * Controlli deterministici sulla bozza del modello. Il modello propone, il codice verifica: sono gli
 * stessi principi del bot (nomi propri solo se nelle fonti, niente anni sbagliati, niente testo di gioco).
 * Non bloccano la bozza: la persona vede cosa è fallito e decide.
 */

export interface DraftContext {
  /** Tutto il testo da cui un nome proprio può legittimamente venire (luogo, quartiere, descrizione attuale, estratti, tag). */
  knownText: string;
  /** Anno del canone (il più citato nei documenti); null se non c'è. */
  canonYear: number | null;
  /** La descrizione che la bozza sostituisce: i suoi fatti non vanno persi. */
  currentDescription?: string;
}

export interface DraftCheck {
  code: 'length' | 'year' | 'anachronism' | 'foreign-words' | 'unknown-name' | 'game-meta' | 'lost-facts';
  ok: boolean;
  detail?: string;
}

export const MIN_DESCRIPTION_CHARS = 40;
export const MAX_DESCRIPTION_CHARS = 400;

/** Maiuscole che non sono nomi inventati: sfondo noto, titoli senza nome, espressioni fisse. */
const CAPITAL_ALLOWED = new Set([
  'londra', 'inghilterra', 'tamigi', 'impero', 'regina', 'dio', 'signore', 'signora', 'signorina', 'madame', 'natale', 'pasqua',
  'domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'altezza', 'maestà', 'eccellenza', 'inglese', 'italiano',
  'vittoria', 'vittoriana', 'vittoriano', 'britannico', 'britannica', 'parlamento',
]);

/** Parole straniere che un modello infila in un testo italiano («boulevard», «terminal»): minuscole, i nomi propri restano. */
const FOREIGN_WORDS = /\b(boulevard|terminal|station|street|market|downtown|skyline)\b/g;

export function foreignWords(text: string): string[] {
  return [...new Set([...text.matchAll(FOREIGN_WORDS)].map((m) => m[1]!))];
}

/**
 * Nomi propri a metà frase che non compaiono nel contesto: il modello li ha inventati («la locanda
 * Blue Boar», «il molo di Cutler»). Salta le parole a inizio frase o a inizio azione (la maiuscola è sintattica).
 */
export function unknownProperNames(draft: string, knownText: string): string[] {
  const known = knownText.toLowerCase();
  const out = new Set<string>();
  for (const m of draft.matchAll(/[A-ZÀ-Ý][a-zà-ÿ']{3,}/g)) {
    const before = draft.slice(0, m.index).trimEnd();
    if (before === '' || /[.!?*:"“«…—-]$/.test(before)) continue;
    const lower = m[0].toLowerCase();
    if (CAPITAL_ALLOWED.has(lower) || known.includes(lower)) continue;
    out.add(m[0]);
  }
  return [...out];
}

/**
 * Nomi propri della descrizione attuale che la bozza non riporta («progettata da Brunel», «St Saviour»):
 * un modello tende a sostituire i fatti con atmosfera generica, e un controllo sugli inventi non lo vede.
 */
export function lostNames(draft: string, currentDescription: string): string[] {
  const kept = draft.toLowerCase();
  const out = new Set<string>();
  for (const m of currentDescription.matchAll(/[A-ZÀ-Ý][a-zà-ÿ']{3,}/g)) {
    const before = currentDescription.slice(0, m.index).trimEnd();
    if (before === '' || /[.!?*:"“«…—-]$/.test(before)) continue;
    if (CAPITAL_ALLOWED.has(m[0].toLowerCase())) continue;
    if (!kept.includes(m[0].toLowerCase())) out.add(m[0]);
  }
  return [...out];
}

export function validateDescription(text: string, ctx: DraftContext): { ok: boolean; checks: DraftCheck[] } {
  const clean = text.trim();
  const checks: DraftCheck[] = [];

  const lengthOk = clean.length >= MIN_DESCRIPTION_CHARS && clean.length <= MAX_DESCRIPTION_CHARS;
  checks.push({ code: 'length', ok: lengthOk, ...(lengthOk ? {} : { detail: `${clean.length} caratteri (da ${MIN_DESCRIPTION_CHARS} a ${MAX_DESCRIPTION_CHARS})` }) });

  const years = [...clean.matchAll(/(?<!\d)(1[89]\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  const wrongYears = years.filter((y) => y !== ctx.canonYear);
  checks.push({ code: 'year', ok: wrongYears.length === 0, ...(wrongYears.length ? { detail: `anno ${[...new Set(wrongYears)].join(', ')}: il canone è ${ctx.canonYear ?? 'non definito'}` } : {}) });

  const anachronisms = [...new Set(findAnachronisms(clean).map((h) => h.word))];
  checks.push({ code: 'anachronism', ok: anachronisms.length === 0, ...(anachronisms.length ? { detail: anachronisms.join(', ') } : {}) });

  const foreign = foreignWords(clean);
  checks.push({ code: 'foreign-words', ok: foreign.length === 0, ...(foreign.length ? { detail: foreign.join(', ') } : {}) });

  const unknown = unknownProperNames(clean, ctx.knownText);
  checks.push({ code: 'unknown-name', ok: unknown.length === 0, ...(unknown.length ? { detail: `nomi non presenti nelle fonti: ${unknown.join(', ')}` } : {}) });

  const lost = ctx.currentDescription ? lostNames(clean, ctx.currentDescription) : [];
  checks.push({ code: 'lost-facts', ok: lost.length === 0, ...(lost.length ? { detail: `non riporta: ${lost.join(', ')}` } : {}) });

  const meta = mentionsGameMeta(clean);
  checks.push({ code: 'game-meta', ok: !meta, ...(meta ? { detail: 'parla del gioco o dei giocatori' } : {}) });

  return { ok: checks.every((c) => c.ok), checks };
}
