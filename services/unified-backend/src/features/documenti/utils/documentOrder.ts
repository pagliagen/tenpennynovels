/**
 * Posizione di un documento appena creato: in coda ai fratelli.
 *
 * Senza un `order` esplicito il documento nasceva con 0 e, ordinando per
 * `order` crescente, finiva in cima alla lista.
 */
export function nextSiblingOrder(maxSiblingOrder: number | null | undefined): number {
  return typeof maxSiblingOrder === 'number' && Number.isFinite(maxSiblingOrder) ? maxSiblingOrder + 1 : 1;
}
