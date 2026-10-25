/**
 * Il testo di gioco dentro l'ambientazione. I documenti `ambientazione` contengono anche frasi che
 * parlano del gioco e dei giocatori («Nel gioco i pronomi…», tutta la «Presentazione»): chi riusa
 * quel testo per far parlare il mondo (il bot dei PNG, le bozze editoriali) non deve ripeterle.
 *
 * Frasi che nominano il gioco, i giocatori, la scheda, il regolamento, i link di rimando.
 * «campagna» (campagna investigativa) sì, «la campagna» (il contado) no; «master» solo minuscolo
 * ("Master Tom" è un ragazzino vittoriano).
 */
const GAME_META = /\b(giocator\w*|giocabil\w*|giocar\w*|gioco|PvE|scheda|regolamento|campagna investigativa|leggi anche)\b|\[[A-Z ]*LINK\]/i;
const GAME_META_CASE = /\bmaster\b/;
const SENTENCE_SPLIT = /(?<=[.!?])\s*(?=[A-ZÀ-Ý“"\[])|\n+/;

/** Frazione di frasi di gioco oltre la quale l'intero chunk è testo per giocatori, non per il mondo. */
export const META_DENSITY = 0.25;

/** Il testo nomina il gioco o i giocatori (una frase basta). */
export function mentionsGameMeta(text: string): boolean {
  return GAME_META.test(text) || GAME_META_CASE.test(text);
}

/**
 * Toglie dal testo le frasi che parlano del gioco. Se sono troppe (`META_DENSITY`) l'intero chunk è
 * materiale per giocatori e non rimane niente. Euristico: una frase di gioco senza parole-spia passa
 * (la «Presentazione» è catturata dalla densità). La soluzione pulita è un flag per documento.
 */
export function stripGameMeta(text: string): string {
  const sentences = text.split(SENTENCE_SPLIT).map((x) => x.trim()).filter(Boolean);
  const keep = sentences.filter((x) => !mentionsGameMeta(x));
  if (sentences.length > 0 && (sentences.length - keep.length) / sentences.length >= META_DENSITY) return '';
  return keep.join(' ');
}
