import type { LorePassage } from '@features/documenti/api';

/**
 * Soglia sul coseno grezzo per dire «i documenti coprono la domanda».
 *
 * Misurata il 2026-10-25 su 20 domande pertinenti e 20 fuori tema, in italiano come le scriverebbe un
 * giocatore (MiniLM, 27 chunk di ambientazione, dopo il filtro `stripGameMeta`): le pertinenti stanno tra
 * 0,445 e 0,755, le fuori tema tra 0 e 0,372, tranne «la guerra dei Cent'anni» a 0,494 che nessuna soglia
 * sotto 0,50 elimina (e 0,50 farebbe perdere il 25% delle risposte giuste). Da 0,38 a 0,44 l'esito è
 * identico: 0,41 sta a metà del vuoto fra i due gruppi. Volutamente nella fascia alta (SINGLE_SOURCE_MIN_COSINE
 * del Bibliotecario è 0,4): l'errore da evitare è far dire al bot qualcosa che il documento non dice.
 * Dipende dal modello di embedding e dai documenti: da rimisurare se cambiano.
 */
export const LORE_MIN_COSINE = 0.41;
const MAX_PASSAGES = 2;
/** Budget di testo totale: il prefill è il collo di bottiglia del modello. */
const MAX_TOTAL_CHARS = 900;
const MAX_PASSAGE_CHARS = 500;
/** Un passaggio che dopo il filtro resta più corto è un frammento, non una risposta. */
const MIN_PASSAGE_CHARS = 80;
/** Frazione di frasi di gioco oltre la quale l'intero chunk è testo per giocatori, non per il mondo. */
const META_DENSITY = 0.25;

export interface BotLore {
  covered: boolean;
  passages: { title: string; heading: string; text: string; score: number }[];
}

/** Taglia a una frase intera (mai a metà), come `sanitizeReply`: una frase tagliata è peggio di una corta. */
export function clipToSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return end > max / 3 ? slice.slice(0, end + 1) : slice.slice(0, slice.lastIndexOf(' ')).trim() + '…';
}

// L'ambientazione contiene anche testo che parla del gioco e dei giocatori («Nel gioco i pronomi…», tutta
// la «Presentazione»): un barista del 1895 non lo può dire. Frasi che nominano il gioco, i giocatori, la
// scheda, il regolamento, i link di rimando. «campagna» (campagna investigativa) sì, «la campagna» (il
// contado) no; «master» solo minuscolo ("Master Tom" è un ragazzino vittoriano).
const GAME_META = /\b(giocator\w*|giocabil\w*|giocar\w*|gioco|PvE|scheda|regolamento|campagna investigativa|leggi anche)\b|\[[A-Z ]*LINK\]/i;
const GAME_META_CASE = /\bmaster\b/;
const SENTENCE_SPLIT = /(?<=[.!?])\s*(?=[A-ZÀ-Ý“"\[])|\n+/;

/**
 * Toglie dal testo le frasi che parlano del gioco. Se sono troppe (`META_DENSITY`) l'intero chunk è
 * materiale per giocatori e non rimane niente. Euristico: una frase di gioco senza parole-spia passa
 * (la «Presentazione» è catturata dalla densità). La soluzione pulita è un flag per documento.
 */
export function stripGameMeta(text: string): string {
  const sentences = text.split(SENTENCE_SPLIT).map((x) => x.trim()).filter(Boolean);
  const keep = sentences.filter((x) => !GAME_META.test(x) && !GAME_META_CASE.test(x));
  if (sentences.length > 0 && (sentences.length - keep.length) / sentences.length >= META_DENSITY) return '';
  return keep.join(' ');
}

export function selectLore(all: LorePassage[]): BotLore {
  const passages = all
    .map((p) => ({ ...p, text: stripGameMeta(p.text) }))
    .filter((p) => p.text.length >= MIN_PASSAGE_CHARS);
  const ranked = [...passages].sort((a, b) => b.vectorScore - a.vectorScore);
  if ((ranked[0]?.vectorScore ?? 0) < LORE_MIN_COSINE) return { covered: false, passages: [] };

  const seen = new Set<string>();
  const out: BotLore['passages'] = [];
  let used = 0;
  for (const p of ranked) {
    if (p.vectorScore < LORE_MIN_COSINE || seen.has(p.documentId)) continue;
    const text = clipToSentence(p.text, Math.min(MAX_PASSAGE_CHARS, MAX_TOTAL_CHARS - used));
    if (text.length < 20) break;
    seen.add(p.documentId);
    used += text.length;
    out.push({ title: p.title, heading: p.heading, text, score: Math.round(p.vectorScore * 100) / 100 });
    if (out.length === MAX_PASSAGES || used >= MAX_TOTAL_CHARS) break;
  }
  return { covered: out.length > 0, passages: out };
}
