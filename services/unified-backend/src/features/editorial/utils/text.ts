/** Taglia a una frase intera (mai a metà); se non c'è, all'ultimo spazio. */
export function clipToSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return end > max / 3 ? slice.slice(0, end + 1) : `${slice.slice(0, slice.lastIndexOf(' ')).trim()}…`;
}

/** «Per l'AI: …» dentro la descrizione è una nota dell'autore al modello, non testo del luogo. */
const AUTHOR_NOTE = /\bper l['’]\s?(?:ai|ia)\s*:/i;

export function splitAuthorNote(text: string): { base: string; note: string } {
  const m = AUTHOR_NOTE.exec(text);
  if (!m) return { base: text.trim(), note: '' };
  return { base: text.slice(0, m.index).trim(), note: text.slice(m.index + m[0].length).trim() };
}
