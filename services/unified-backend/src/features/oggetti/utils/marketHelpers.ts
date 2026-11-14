/**
 * Helper puri del Mercato: confronto occupazione del personaggio con gli id
 * salvati negli item. `character.occupation` è un ObjectId (ref Occupation),
 * `requiredOccupations` / `tradeOccupations` arrivano come stringhe o ObjectId
 * (a seconda di lean()): si confronta sempre per stringa.
 */

type IdLike = { toString(): string } | string | null | undefined;

export function toIdString(value: IdLike): string | null {
  if (value === null || value === undefined) return null;
  const s = value.toString();
  return s.length > 0 ? s : null;
}

/** true se l'occupazione del personaggio è nell'elenco. Elenco vuoto/assente = false. */
export function occupationIn(list: readonly IdLike[] | undefined, occupation: IdLike): boolean {
  const occ = toIdString(occupation);
  if (!occ || !list || list.length === 0) return false;
  return list.some((entry) => toIdString(entry) === occ);
}
