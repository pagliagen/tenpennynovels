/**
 * Formato ammesso per lo slug di un documento.
 *
 * Deve coincidere con PATH_SEGMENT_RE di apps/documents/src/pages/api/revalidate.ts:
 * uno slug fuori da questo formato verrebbe scartato in silenzio dalla
 * revalidation ISR e la pagina resterebbe stantia fino a un'ora.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_SLUG_LENGTH = 100;

/** Messaggio di errore (italiano, per l'utente) o null se lo slug è valido. */
export function validateSlug(slug: unknown): string | null {
  if (typeof slug !== 'string' || slug.length === 0) {
    return 'Lo slug è obbligatorio';
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    return `Lo slug non può superare ${MAX_SLUG_LENGTH} caratteri`;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return 'Lo slug può contenere solo lettere minuscole, numeri e trattini singoli (es. epoca-vittoriana)';
  }
  return null;
}
