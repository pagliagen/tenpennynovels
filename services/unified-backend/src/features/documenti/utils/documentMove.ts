/**
 * Regole pure per spostare un documento nell'albero (cambio di `parentId`).
 *
 * Nessuna dipendenza da Mongoose: lavora su una mappa in memoria dei documenti
 * di un tipo, così le regole si verificano senza database
 * (vedi __tests__/documentMove.test.ts).
 *
 * Perché servono: `parentId` era accettato così com'è da `PATCH /:id`. Un ciclo
 * (A figlio di B, B figlio di A) farebbe girare a vuoto le ricorsioni di
 * `HierarchyService` e dell'albero del gestionale, e uno spostamento fra
 * sottotipi diversi lascerebbe il documento nel sidebar sotto un sottotipo ma
 * con l'URL di un altro (`path` = `{subtype.slug}/{doc.slug}`).
 */

/**
 * Profondità massima dell'albero (radice = 0). È il `maxDepth` con cui
 * `HierarchyService` scende dai figli: oltre, i documenti sparirebbero dalla
 * pagina pubblica del padre senza alcun errore.
 */
export const MAX_DOCUMENT_DEPTH = 5;

export interface DocumentNodeLite {
  id: string;
  parentId: string | null;
  subtypeId: string;
  type: string;
  path?: string;
}

export type MoveViolation =
  | 'DOCUMENT_NOT_FOUND'
  | 'PARENT_NOT_FOUND'
  | 'SELF_PARENT'
  | 'CYCLE'
  | 'TYPE_MISMATCH'
  | 'SUBTYPE_MISMATCH'
  | 'TOO_DEEP';

/** Antenati di `startId`, dal padre alla radice. `null` se la catena contiene un ciclo. */
function ancestorsOf(nodes: Map<string, DocumentNodeLite>, startId: string): string[] | null {
  const chain: string[] = [];
  const seen = new Set<string>([startId]);
  let current = nodes.get(startId)?.parentId ?? null;

  while (current !== null) {
    if (seen.has(current)) return null;
    seen.add(current);
    chain.push(current);
    current = nodes.get(current)?.parentId ?? null;
  }
  return chain;
}

/** Altezza del sottoalbero di `rootId` (foglia = 0). Robusta a cicli preesistenti. */
function subtreeHeight(nodes: Map<string, DocumentNodeLite>, rootId: string): number {
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes.values()) {
    if (node.parentId === null) continue;
    const siblings = childrenOf.get(node.parentId) ?? [];
    siblings.push(node.id);
    childrenOf.set(node.parentId, siblings);
  }

  let height = 0;
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const childId of childrenOf.get(id) ?? []) {
        if (seen.has(childId)) continue;
        seen.add(childId);
        next.push(childId);
      }
    }
    if (next.length > 0) height += 1;
    frontier = next;
  }
  return height;
}

/**
 * Verifica se `docId` può diventare figlio di `newParentId` (`null` = radice).
 * Restituisce la prima violazione, o `null` se lo spostamento è lecito.
 */
export function validateReparent(
  nodes: Map<string, DocumentNodeLite>,
  docId: string,
  newParentId: string | null
): MoveViolation | null {
  const doc = nodes.get(docId);
  if (!doc) return 'DOCUMENT_NOT_FOUND';

  // Diventare radice non ha vincoli di tipo/sottotipo/profondità: il documento
  // resta nel proprio sottotipo e la sua profondità può solo diminuire.
  if (newParentId === null) return null;

  if (newParentId === docId) return 'SELF_PARENT';

  const parent = nodes.get(newParentId);
  if (!parent) return 'PARENT_NOT_FOUND';

  if (parent.type !== doc.type) return 'TYPE_MISMATCH';
  if (parent.subtypeId !== doc.subtypeId) return 'SUBTYPE_MISMATCH';

  const parentAncestors = ancestorsOf(nodes, newParentId);
  if (parentAncestors === null || parentAncestors.includes(docId)) return 'CYCLE';

  const newDepth = parentAncestors.length + 1;
  if (newDepth + subtreeHeight(nodes, docId) > MAX_DOCUMENT_DEPTH) return 'TOO_DEEP';

  return null;
}

/**
 * Nuovo ordine dei fratelli dopo aver inserito `movedId` prima di `beforeId`
 * (`null` = in coda). `null` se `beforeId` non è fra i fratelli di destinazione.
 */
export function placeAmongSiblings(
  siblingIds: string[],
  movedId: string,
  beforeId: string | null
): string[] | null {
  const others = siblingIds.filter((id) => id !== movedId);

  if (beforeId === null) return [...others, movedId];

  const index = others.indexOf(beforeId);
  if (index === -1) return null;

  return [...others.slice(0, index), movedId, ...others.slice(index)];
}
