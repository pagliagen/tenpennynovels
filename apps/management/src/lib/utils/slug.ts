/**
 * Slug di un documento a partire dal titolo.
 *
 * Il formato (minuscole, numeri, trattini singoli) è quello che il backend
 * accetta in validateSlug (services/unified-backend/.../slugValidation.ts) e che
 * la revalidation ISR di apps/documents richiede. I trattini ripetuti vanno
 * collassati: "A - B" prima dava "a---b", rifiutato dal backend.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Stesso formato di validateSlug lato backend (senza il limite di lunghezza). */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
