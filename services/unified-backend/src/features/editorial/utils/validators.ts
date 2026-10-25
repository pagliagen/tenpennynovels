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
  code: 'length' | 'year' | 'anachronism' | 'foreign-words' | 'unknown-name' | 'game-meta' | 'lost-facts' | 'variable-conditions' | 'invented-material' | 'filler' | 'positions';
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

/** Parole comuni di 5+ lettere che non portano un fatto: non contano per verificare cosa la bozza ha conservato. */
const COMMON_WORDS = new Set([
  'questo', 'questa', 'questi', 'queste', 'sempre', 'molto', 'nella', 'nello', 'nelle', 'negli', 'della', 'delle', 'degli', 'dello',
  'dalla', 'dalle', 'dagli', 'dallo', 'sulla', 'sulle', 'sugli', 'sullo', 'tutti', 'tutte', 'tutto', 'dove', 'quale', 'quali', 'anche',
  'ancora', 'stato', 'stata', 'essere', 'altro', 'altra', 'altri', 'altre', 'dopo', 'prima', 'verso', 'tanto', 'tanti', 'tante', 'quasi',
  'spesso', 'cosa', 'cose', 'luogo', 'luoghi', 'dalla', 'attraverso', 'insieme', 'tra', 'fra',
]);

const stem = (word: string): string => word.slice(0, 5);

function contentWords(text: string): Map<string, string> {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const out = new Map<string, string>();
  for (const w of normalized.match(/[a-z]{5,}/g) ?? []) if (!COMMON_WORDS.has(w) && !out.has(stem(w))) out.set(stem(w), w);
  return out;
}

/** Quota minima delle parole-chiave del testo dell'autore che la bozza deve riportare. */
export const MIN_KEPT_CONTENT = 0.6;

/**
 * Parole-chiave (radici di 5+ lettere) del testo dell'autore che la bozza non riporta. «Espandere» vuol dire
 * che ciò che l'autore ha scritto resta: una stazione che diventa «cattedrale» perde «stazione» e «ferroviaria».
 */
export function missingContent(draft: string, base: string): { missing: string[]; keptRatio: number } {
  const wanted = contentWords(base);
  if (wanted.size < 3) return { missing: [], keptRatio: 1 };
  const have = contentWords(draft);
  const missing = [...wanted].filter(([st]) => !have.has(st)).map(([, w]) => w);
  return { missing, keptRatio: 1 - missing.length / wanted.size };
}

/**
 * Condizioni che in gioco cambiano (meteo, ora, luce): una descrizione fissa che dice «nebbie» resta vera anche
 * quando la sidebar mostra la neve. Si segnalano solo se l'autore non le ha scritte lui.
 */
const VARIABLE_CONDITIONS = /\b(nebbi\w*|foschi\w*|bruma|brume|piogg\w*|piov\w*|pioviggin\w*|acquazzon\w*|nev\w*|gelo|gelid\w*|vent[oi]|ventos\w*|soleggiat\w*|sole|tramont\w*|alba|albe|crepuscol\w*|mattin\w*|pomerigg\w*|serata|sera|notte|notturn\w*|luce|luci|lume|lumi|chiarore|penombra|ombre|ombra|umid\w*|vapor\w*)\b/gi;

/** Materiali e colori che il modello aggiunge di suo («ponti di pietra»): fatti nuovi, non atmosfera. */
const INVENTED_MATERIALS = /\b(pietr\w*|marm\w*|legn\w*|ferr\w*|ghisa|mattoni|mattone|vetr\w*|ottone|bronz\w*|quercia|velluto|cuoio|rame|granito|acciaio|dorat\w*|argentat\w*|rossastr\w*|scuri|scuro|scura|scure|nero|nera|neri|nere|bianc\w*)\b/gi;

/** Frasi fatte che il modello ripete in ogni bozza: poche, ma riconoscibili. */
const FILLER = /(soffus\w*|fiocc\w*|aria (?:è )?dens\w*|dens[ao] (?:di|del|dell)|filtr\w* (?:tra|dalle|attraverso))/gi;

const stemOf = (w: string): string => w.toLowerCase().slice(0, 5);

/** Parole del pattern presenti nella bozza e non nel testo dell'autore (confronto per radice). */
function newWords(pattern: RegExp, draft: string, base: string): string[] {
  const have = new Set([...base.matchAll(pattern)].map((m) => stemOf(m[0])));
  return [...new Set([...draft.matchAll(pattern)].map((m) => m[0].toLowerCase()).filter((w) => !have.has(stemOf(w))))];
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

  // Il testo dell'autore deve restare: nomi propri e parole-chiave. Espandere non è riscrivere.
  const base = ctx.currentDescription ?? '';
  const lost = base ? lostNames(clean, base) : [];
  const { missing, keptRatio } = base ? missingContent(clean, base) : { missing: [], keptRatio: 1 };
  const lostOk = lost.length === 0 && keptRatio >= MIN_KEPT_CONTENT;
  checks.push({ code: 'lost-facts', ok: lostOk, ...(lostOk ? {} : { detail: `non riporta: ${[...lost, ...missing].slice(0, 6).join(', ')}` }) });

  const conditions = newWords(VARIABLE_CONDITIONS, clean, base);
  checks.push({ code: 'variable-conditions', ok: conditions.length === 0, ...(conditions.length ? { detail: `meteo, ora o luce che in gioco cambiano: ${conditions.join(', ')}` } : {}) });

  const materials = newWords(INVENTED_MATERIALS, clean, base);
  checks.push({ code: 'invented-material', ok: materials.length === 0, ...(materials.length ? { detail: `materiali o colori non scritti da te: ${materials.join(', ')}` } : {}) });

  const filler = newWords(FILLER, clean, base);
  checks.push({ code: 'filler', ok: filler.length === 0, ...(filler.length ? { detail: `frasi fatte: ${filler.join(', ')}` } : {}) });

  const meta = mentionsGameMeta(clean);
  checks.push({ code: 'game-meta', ok: !meta, ...(meta ? { detail: 'parla del gioco o dei giocatori' } : {}) });

  return { ok: checks.every((c) => c.ok), checks };
}

export const MAX_POSITIONS = 3;
export const MAX_POSITION_NAME_CHARS = 30;
export const MAX_POSITION_DESCRIPTION_CHARS = 160;

export interface SuggestedPosition {
  name: string;
  description: string;
}

/** Entrata e uscita non sono posti dove stare: sono il motivo per cui si generano posizioni vere. */
const PASSAGE_NAMES = /^(ingresso|uscita|entrata|porta|ingresso principale|uscita principale)$/i;

const norm = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Pulisce ciò che il modello ha restituito (forma, doppioni, ingresso/uscita, posizioni già presenti, massimo 3)
 * e controlla il testo: lo scarto qui è silenzioso, i controlli sul testo informano la persona.
 */
export function cleanPositions(raw: unknown, existing: string[]): SuggestedPosition[] {
  if (!Array.isArray(raw)) return [];
  const taken = new Set(existing.map(norm));
  const out: SuggestedPosition[] = [];
  for (const item of raw) {
    const name = typeof (item as { name?: unknown })?.name === 'string' ? (item as { name: string }).name.trim().replace(/[.:;]+$/, '').replace(/^./, (c) => c.toUpperCase()) : '';
    const description = typeof (item as { description?: unknown })?.description === 'string' ? (item as { description: string }).description.trim() : '';
    if (!name || !description || name.length > MAX_POSITION_NAME_CHARS || PASSAGE_NAMES.test(name) || taken.has(norm(name))) continue;
    taken.add(norm(name));
    out.push({ name, description: description.slice(0, MAX_POSITION_DESCRIPTION_CHARS + 40) });
    if (out.length === MAX_POSITIONS) break;
  }
  return out;
}

export function validatePositions(positions: SuggestedPosition[], knownText: string): { ok: boolean; checks: DraftCheck[] } {
  const checks: DraftCheck[] = [];
  checks.push({ code: 'positions', ok: positions.length > 0, ...(positions.length ? {} : { detail: 'nessuna posizione utilizzabile' }) });

  const long = positions.filter((p) => p.description.length > MAX_POSITION_DESCRIPTION_CHARS).map((p) => p.name);
  checks.push({ code: 'length', ok: long.length === 0, ...(long.length ? { detail: `descrizione troppo lunga: ${long.join(', ')}` } : {}) });

  const text = positions.map((p) => `${p.name}. ${p.description}`).join(' ');
  const years = [...text.matchAll(/(?<!\d)(1[89]\d{2})(?!\d)/g)].map((m) => m[1]!);
  checks.push({ code: 'year', ok: years.length === 0, ...(years.length ? { detail: `anni nel testo: ${[...new Set(years)].join(', ')}` } : {}) });

  const anachronisms = [...new Set(findAnachronisms(text).map((h) => h.word))];
  checks.push({ code: 'anachronism', ok: anachronisms.length === 0, ...(anachronisms.length ? { detail: anachronisms.join(', ') } : {}) });

  const foreign = foreignWords(text);
  checks.push({ code: 'foreign-words', ok: foreign.length === 0, ...(foreign.length ? { detail: foreign.join(', ') } : {}) });

  const unknown = unknownProperNames(text, knownText);
  checks.push({ code: 'unknown-name', ok: unknown.length === 0, ...(unknown.length ? { detail: `nomi non presenti nelle fonti: ${unknown.join(', ')}` } : {}) });

  const conditions = newWords(VARIABLE_CONDITIONS, text, knownText);
  checks.push({ code: 'variable-conditions', ok: conditions.length === 0, ...(conditions.length ? { detail: `meteo, ora o luce che in gioco cambiano: ${conditions.join(', ')}` } : {}) });

  const materials = newWords(INVENTED_MATERIALS, text, knownText);
  checks.push({ code: 'invented-material', ok: materials.length === 0, ...(materials.length ? { detail: `materiali o colori non scritti da te: ${materials.join(', ')}` } : {}) });

  const meta = mentionsGameMeta(text);
  checks.push({ code: 'game-meta', ok: !meta, ...(meta ? { detail: 'parla del gioco o dei giocatori' } : {}) });

  return { ok: checks.every((c) => c.ok), checks };
}
