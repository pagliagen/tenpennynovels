import { stripGameMeta, type LorePassage } from '@features/documenti/api';

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
