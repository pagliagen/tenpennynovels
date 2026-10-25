/** Taglia a una frase intera (mai a metà); se non c'è, all'ultimo spazio. */
export function clipToSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return end > max / 3 ? slice.slice(0, end + 1) : `${slice.slice(0, slice.lastIndexOf(' ')).trim()}…`;
}
