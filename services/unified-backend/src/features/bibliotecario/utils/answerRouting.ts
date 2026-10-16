/**
 * Decide se una domanda merita il Bibliotecario, e con quale contesto.
 *
 * Il punteggio RRF di /search non serve a questo: è basato sul rank, quindi il
 * primo risultato vale sempre ~95-100% anche per "chi ha vinto i Mondiali
 * 2006?" (misurato 2026-10-16). Qui si usa il coseno grezzo di Qdrant, che
 * invece separa i casi, più la corrispondenza tra domanda e intestazione.
 *
 * Tre esiti:
 *  - direct:      una sezione si intitola come la domanda ("Come si apre un
 *                 ticket?" ↔ "Come aprire un ticket"). L'utente ha già il link
 *                 in cima: l'AI sarebbe 30s di CPU per ripetere la pagina.
 *  - synthesis:   la risposta va ricavata da uno o più documenti. All'AI vanno
 *                 fino a MAX_SYNTHESIS_CHUNKS chunk di documenti diversi.
 *  - not_covered: niente di abbastanza vicino. Un LLM piccolo qui inventa
 *                 (qwen3.5:2b/4b nei test) o spreca 30s per dire "non so":
 *                 si risponde subito con un messaggio statico.
 */

import type { ContextChunk } from '@core/extensions/points';

/**
 * Misure sul server (MiniLM, 2026-10-16), coseno del miglior chunk:
 * non coperte 0.16-0.26 (Mondiali 2006: 0.252) · borderline coperte
 * 0.298-0.31 · dirette/trasversali 0.37-0.62. Il margine tra 0.252 e 0.298 è
 * stretto: i valori vanno ritarati con le decisioni loggate da `decideRoute`.
 * Dipendono dal modello di embedding: se cambia, rimisurare.
 */
export const NOT_COVERED_BELOW = 0.27;
// Il controller recupera i match vettoriali da 0.1 (QUESTION_FETCH_MIN_SIMILARITY): deve restare sotto questa soglia.

/** Un chunk entra nel contesto della sintesi solo se è almeno così vicino. */
export const SYNTHESIS_MIN_COSINE = 0.25;

/**
 * Con una sola fonte il contesto deve essere forte. Il 2026-10-16 "Dove posso
 * giocare una quest in un posto poco frequentato?" in ambientazione (coseno
 * 0.298, un solo chunk: l'intro di un documento) ha prodotto una risposta con
 * Lambeth, Stepney e "foreste vicine a Londra", nessuna presente nei
 * documenti: il 4b riempie i vuoti. Sotto questa soglia serve convergenza di
 * almeno due documenti, altrimenti la domanda è di fatto non coperta.
 */
export const SINGLE_SOURCE_MIN_COSINE = 0.4;

/**
 * Quanto servono più chunk: oltre 3 il prefill su CPU (~30 tok/s) sfora il
 * timeout di 60s di KeeperClient.ask; con budget 2500/800 ne entrano 3.
 */
export const MAX_SYNTHESIS_CHUNKS = 3;

/** Soglia di somiglianza (Jaccard "morbido") tra domanda e intestazione. */
const DIRECT_MIN_SIMILARITY = 0.6;
/** Una sola parola in comune non basta a dire che la sezione risponde. */
const DIRECT_MIN_SHARED_TOKENS = 2;
/** Solo i primi risultati per rank possono essere una risposta diretta. */
const DIRECT_CANDIDATES = 5;

export type ScoredChunk = ContextChunk;

export type AnswerRoute =
  | { mode: 'direct'; matchedHeading: string }
  | { mode: 'synthesis'; chunks: ScoredChunk[] }
  | { mode: 'not_covered' };

// Articoli, preposizioni, pronomi e ausiliari: non portano contenuto. Le parole
// interrogative (come, cosa, dove...) restano di proposito: "Come si gioca?" e
// "Cosa si gioca?" sono domande diverse.
const STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  'e', 'ed', 'o', 'ma', 'che', 'si', 'mi', 'ti', 'ci', 'vi', 'ne', 'è', 'e\'', 'sono',
  'posso', 'puo', 'può', 'devo', 'deve', 'mio', 'mia', 'miei', 'mie', 'tuo', 'tua',
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Due parole "coincidono" se condividono il prefisso senza quasi differire
 * (apre/aprire, gioca/giocate, ticket/tickets) ma non per un prefisso corto
 * (gioca/giornale). Non è uno stemmer: serve solo a confrontare intestazioni.
 */
function tokensMatch(a: string, b: string): boolean {
  let common = 0;
  const max = Math.min(a.length, b.length);
  while (common < max && a[common] === b[common]) common++;
  const need = max >= 5 ? Math.max(4, max - 2) : Math.max(3, max - 1);
  return common >= need;
}

function headingSimilarity(question: string, heading: string): { shared: number; similarity: number } {
  const q = normalize(question);
  const h = normalize(heading);
  if (q.length === 0 || h.length === 0) return { shared: 0, similarity: 0 };

  const usedHeadingTokens = new Set<number>();
  let shared = 0;
  for (const token of q) {
    const idx = h.findIndex((ht, i) => !usedHeadingTokens.has(i) && tokensMatch(token, ht));
    if (idx !== -1) {
      usedHeadingTokens.add(idx);
      shared++;
    }
  }

  return { shared, similarity: shared / (q.length + h.length - shared) };
}

/** Le sezioni senza titolo (intro del documento) si confrontano col titolo del documento. */
function labelOf(chunk: ContextChunk): string {
  return chunk.heading?.trim() || chunk.source.title?.trim() || '';
}

export function decideRoute(question: string, chunks: ScoredChunk[]): AnswerRoute {
  for (const chunk of chunks.slice(0, DIRECT_CANDIDATES)) {
    const label = labelOf(chunk);
    const { shared, similarity } = headingSimilarity(question, label);
    if (shared >= DIRECT_MIN_SHARED_TOKENS && similarity >= DIRECT_MIN_SIMILARITY) {
      return { mode: 'direct', matchedHeading: label };
    }
  }

  const topCosine = chunks.reduce((max, c) => Math.max(max, c.vectorScore ?? 0), 0);
  if (topCosine < NOT_COVERED_BELOW) return { mode: 'not_covered' };

  // Un chunk per documento, i più vicini per primi: il contesto deve coprire
  // più fonti, non tre pezzi dello stesso documento.
  const seenDocuments = new Set<string>();
  const picked: ScoredChunk[] = [];
  const byCosine = [...chunks]
    .filter((c) => (c.vectorScore ?? 0) >= SYNTHESIS_MIN_COSINE)
    .sort((a, b) => (b.vectorScore ?? 0) - (a.vectorScore ?? 0));

  for (const chunk of byCosine) {
    const documentKey = chunk.source.documentId ?? chunk.source.fullPath ?? chunk.heading;
    if (seenDocuments.has(documentKey)) continue;
    seenDocuments.add(documentKey);
    picked.push(chunk);
    if (picked.length === MAX_SYNTHESIS_CHUNKS) break;
  }

  if (picked.length < 2 && topCosine < SINGLE_SOURCE_MIN_COSINE) return { mode: 'not_covered' };

  return { mode: 'synthesis', chunks: picked };
}

const SECTION_LABELS: Record<string, string> = {
  ambientazione: 'Ambientazione',
  regolamento: 'Regolamento',
  'manuale-master': 'Manuale Master',
};

/** Messaggio mostrato come risposta del Bibliotecario quando non c'è nulla di pertinente. */
export function notCoveredMessage(scope?: string): string {
  const label = scope ? SECTION_LABELS[scope] : undefined;
  return label
    ? `Non ho trovato nulla di pertinente in ${label}.`
    : 'Non ho trovato nulla di pertinente nei documenti.';
}
