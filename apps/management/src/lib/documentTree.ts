/**
 * Logica pura per spostare i documenti nell'albero del gestionale (drag & drop).
 *
 * Separata dal componente perché è la parte che ha le regole (cicli, sottotipi,
 * profondità, posizioni no-op) e si può verificare senza DOM né dnd-kit.
 * Le stesse regole sono applicate dal backend
 * (`services/unified-backend/.../utils/documentMove.ts`), che è l'autorità:
 * qui servono a non proporre drop che il server rifiuterebbe.
 */
import type { DocumentTreeNode } from '@/types/api/Document';

/** Gemella di `MAX_DOCUMENT_DEPTH` del backend (radice = 0). Modificarle insieme. */
export const MAX_DOCUMENT_DEPTH = 5;

/** Dove cade il puntatore rispetto alla riga: bordo alto, centro, bordo basso. */
export type DropPosition = 'before' | 'inside' | 'after';

/** Destinazione di uno spostamento: stessa forma del body di `PATCH /:id/move`. */
export interface MoveTarget {
  parentId: string | null;
  /** Fratello davanti a cui inserire; `null` = in coda. */
  beforeId: string | null;
}

interface Located {
  node: DocumentTreeNode;
  parentId: string | null;
  siblings: DocumentTreeNode[];
  depth: number;
}

function locate(
  nodes: DocumentTreeNode[],
  id: string,
  parentId: string | null = null,
  depth = 0
): Located | null {
  for (const node of nodes) {
    if (node._id === id) return { node, parentId, siblings: nodes, depth };
    const found = locate(node.children, id, node._id, depth + 1);
    if (found) return found;
  }
  return null;
}

function containsNode(root: DocumentTreeNode, id: string): boolean {
  return root.children.some((child) => child._id === id || containsNode(child, id));
}

/** Altezza del sottoalbero (foglia = 0). */
function height(node: DocumentTreeNode): number {
  return node.children.reduce((max, child) => Math.max(max, height(child) + 1), 0);
}

/** Zona di drop dalla posizione verticale del puntatore dentro la riga. */
export function zoneFromPointer(pointerY: number, rect: { top: number; height: number }): DropPosition {
  if (rect.height <= 0) return 'inside';
  const ratio = (pointerY - rect.top) / rect.height;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return 'inside';
}

/** Primo fratello dopo `index` che non sia il documento trascinato. */
function nextSiblingId(siblings: DocumentTreeNode[], index: number, activeId: string): string | null {
  for (let i = index + 1; i < siblings.length; i += 1) {
    const candidate = siblings[i];
    if (candidate && candidate._id !== activeId) return candidate._id;
  }
  return null;
}

/**
 * Traduce "ho rilasciato `activeId` sulla riga `overId`, in questa zona" in una
 * destinazione. `null` se il drop non è lecito o non cambierebbe nulla.
 *
 * `expandedIds`: sotto una riga espansa il bordo basso coincide visivamente con
 * il primo figlio, quindi "after" significa "come primo figlio".
 */
export function resolveDrop(
  tree: DocumentTreeNode[],
  activeId: string,
  overId: string,
  position: DropPosition,
  expandedIds: ReadonlySet<string>
): MoveTarget | null {
  if (activeId === overId) return null;

  const active = locate(tree, activeId);
  const over = locate(tree, overId);
  if (!active || !over) return null;

  // Non si può entrare nel proprio sottoalbero.
  if (containsNode(active.node, overId)) return null;

  let target: MoveTarget;
  if (position === 'inside') {
    target = { parentId: overId, beforeId: null };
  } else if (position === 'before') {
    target = { parentId: over.parentId, beforeId: overId };
  } else if (over.node.children.length > 0 && expandedIds.has(overId)) {
    const first = over.node.children.find((child) => child._id !== activeId);
    target = { parentId: overId, beforeId: first?._id ?? null };
  } else {
    const index = over.siblings.findIndex((sibling) => sibling._id === overId);
    target = { parentId: over.parentId, beforeId: nextSiblingId(over.siblings, index, activeId) };
  }

  if (target.parentId !== null) {
    const newParent = locate(tree, target.parentId);
    if (!newParent) return null;
    if ((newParent.node.subtype?._id ?? null) !== (active.node.subtype?._id ?? null)) return null;
    if (newParent.depth + 1 + height(active.node) > MAX_DOCUMENT_DEPTH) return null;
  }

  // Stessa posizione di partenza: niente chiamata al server.
  if (target.parentId === active.parentId) {
    const current = active.siblings.map((sibling) => sibling._id).filter((id) => id !== activeId);
    const currentIndex = active.siblings.findIndex((sibling) => sibling._id === activeId);
    const currentBefore = current[currentIndex] ?? null;
    if (target.beforeId === currentBefore) return null;
  }

  return target;
}

function renumber(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
  return nodes.map((node, index) => (node.order === index + 1 ? node : { ...node, order: index + 1 }));
}

function removeNode(
  nodes: DocumentTreeNode[],
  id: string
): { nodes: DocumentTreeNode[]; removed: DocumentTreeNode | null } {
  const index = nodes.findIndex((node) => node._id === id);
  if (index !== -1) {
    const removed = nodes[index] ?? null;
    return { nodes: renumber(nodes.filter((_, i) => i !== index)), removed };
  }

  let removed: DocumentTreeNode | null = null;
  const next = nodes.map((node) => {
    if (removed || node.children.length === 0) return node;
    const result = removeNode(node.children, id);
    if (!result.removed) return node;
    removed = result.removed;
    return { ...node, children: result.nodes };
  });
  return { nodes: removed ? next : nodes, removed };
}

function insertNode(
  nodes: DocumentTreeNode[],
  parentId: string | null,
  moved: DocumentTreeNode,
  beforeId: string | null
): DocumentTreeNode[] {
  if (parentId === null) {
    const index = beforeId === null ? -1 : nodes.findIndex((node) => node._id === beforeId);
    const list = [...nodes];
    list.splice(index === -1 ? list.length : index, 0, moved);
    return renumber(list);
  }

  return nodes.map((node) => {
    if (node._id === parentId) {
      return { ...node, children: insertNode(node.children, null, moved, beforeId) };
    }
    if (node.children.length === 0) return node;
    return { ...node, children: insertNode(node.children, parentId, moved, beforeId) };
  });
}

/**
 * Applica lo spostamento a una copia dell'albero (aggiornamento ottimistico).
 * Rinumera `order` come fa il server: 1..n in entrambe le liste toccate.
 */
export function applyMove(tree: DocumentTreeNode[], id: string, target: MoveTarget): DocumentTreeNode[] {
  const { nodes, removed } = removeNode(tree, id);
  if (!removed) return tree;
  return insertNode(nodes, target.parentId, { ...removed, parentId: target.parentId }, target.beforeId);
}
