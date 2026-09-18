import type { DocumentTreeNode } from '@/types/api/Document';

import {
  applyMove,
  MAX_DOCUMENT_DEPTH,
  resolveDrop,
  zoneFromPointer,
  type MoveTarget
} from './documentTree';

const NONE: ReadonlySet<string> = new Set();

function node(
  id: string,
  children: DocumentTreeNode[] = [],
  order = 1,
  subtypeId = 's1'
): DocumentTreeNode {
  return {
    _id: id,
    slug: id,
    title: id,
    isDraft: false,
    visible: true,
    isPublic: true,
    order,
    parentId: null,
    subtype: { _id: subtypeId, slug: subtypeId, title: subtypeId },
    children: children.map((child) => ({ ...child, parentId: id }))
  };
}

/** classi(lower, upper) · altro · estraneo (altro sottotipo) */
function sample(): DocumentTreeNode[] {
  return [
    node('classi', [node('lower', [], 1), node('upper', [], 2)], 1),
    node('altro', [], 2),
    node('estraneo', [], 3, 's2')
  ];
}

const ids = (nodes: DocumentTreeNode[]) => nodes.map((n) => n._id);

describe('resolveDrop', () => {
  it('promuove un figlio a primo livello, prima di un documento radice', () => {
    expect(resolveDrop(sample(), 'lower', 'altro', 'before', NONE)).toEqual({
      parentId: null,
      beforeId: 'altro'
    });
  });

  it('promuove un figlio a primo livello in coda alle radici', () => {
    expect(resolveDrop(sample(), 'lower', 'estraneo', 'after', NONE)).toEqual({
      parentId: null,
      beforeId: null
    });
  });

  it('rende figlio (in coda) un documento rilasciato al centro di un altro', () => {
    expect(resolveDrop(sample(), 'altro', 'classi', 'inside', NONE)).toEqual({
      parentId: 'classi',
      beforeId: null
    });
  });

  it('con la riga espansa, il bordo basso significa "primo figlio"', () => {
    expect(resolveDrop(sample(), 'altro', 'classi', 'after', new Set(['classi']))).toEqual({
      parentId: 'classi',
      beforeId: 'lower'
    });
  });

  it('con la riga chiusa, il bordo basso è "dopo di lei" fra i fratelli', () => {
    expect(resolveDrop(sample(), 'altro', 'classi', 'after', NONE)).toBeNull(); // già lì
    expect(resolveDrop(sample(), 'classi', 'altro', 'after', NONE)).toEqual({
      parentId: null,
      beforeId: 'estraneo'
    });
  });

  it('rifiuta di entrare nel proprio sottoalbero e in se stesso', () => {
    expect(resolveDrop(sample(), 'classi', 'lower', 'inside', NONE)).toBeNull();
    expect(resolveDrop(sample(), 'classi', 'lower', 'before', NONE)).toBeNull();
    expect(resolveDrop(sample(), 'classi', 'classi', 'inside', NONE)).toBeNull();
  });

  it('rifiuta un padre di un altro sottotipo, ma non un drop fra le radici', () => {
    expect(resolveDrop(sample(), 'altro', 'estraneo', 'inside', NONE)).toBeNull();
    expect(resolveDrop(sample(), 'classi', 'estraneo', 'before', NONE)).toEqual({
      parentId: null,
      beforeId: 'estraneo'
    });
  });

  it('riconosce come no-op lo stesso posto', () => {
    expect(resolveDrop(sample(), 'lower', 'upper', 'before', NONE)).toBeNull();
    expect(resolveDrop(sample(), 'lower', 'lower', 'before', NONE)).toBeNull();
    expect(resolveDrop(sample(), 'upper', 'lower', 'after', NONE)).toBeNull();
    expect(resolveDrop(sample(), 'lower', 'upper', 'after', NONE)).toEqual({
      parentId: 'classi',
      beforeId: null
    });
  });

  it('rispetta il limite di profondità contando il sottoalbero trascinato', () => {
    let chain = node('n5');
    for (let i = 4; i >= 0; i -= 1) chain = node(`n${i}`, [chain]);
    const tree = [chain, node('blocco', [node('figlio')])];

    expect(MAX_DOCUMENT_DEPTH).toBe(5);
    expect(resolveDrop(tree, 'blocco', 'n5', 'inside', NONE)).toBeNull();
    expect(resolveDrop(tree, 'blocco', 'n1', 'inside', NONE)).toEqual({ parentId: 'n1', beforeId: null });
  });
});

describe('applyMove', () => {
  it('promuove un figlio: cambia parentId e rinumera le due liste', () => {
    const target: MoveTarget = { parentId: null, beforeId: 'altro' };
    const result = applyMove(sample(), 'lower', target);

    expect(ids(result)).toEqual(['classi', 'lower', 'altro', 'estraneo']);
    expect(result.map((n) => n.order)).toEqual([1, 2, 3, 4]);
    expect(result[1]?.parentId).toBeNull();
    expect(ids(result[0]?.children ?? [])).toEqual(['upper']);
    expect(result[0]?.children[0]?.order).toBe(1);
  });

  it('rende figlio un documento di primo livello, in coda', () => {
    const result = applyMove(sample(), 'altro', { parentId: 'classi', beforeId: null });

    expect(ids(result)).toEqual(['classi', 'estraneo']);
    expect(ids(result[0]?.children ?? [])).toEqual(['lower', 'upper', 'altro']);
    expect(result[0]?.children[2]).toMatchObject({ parentId: 'classi', order: 3 });
  });

  it('riordina fra fratelli e non muta l\'albero di partenza', () => {
    const tree = sample();
    const snapshot = JSON.stringify(tree);
    const result = applyMove(tree, 'upper', { parentId: 'classi', beforeId: 'lower' });

    expect(ids(result[0]?.children ?? [])).toEqual(['upper', 'lower']);
    expect(JSON.stringify(tree)).toBe(snapshot);
  });

  it('ignora un id inesistente', () => {
    const tree = sample();
    expect(applyMove(tree, 'fantasma', { parentId: null, beforeId: null })).toBe(tree);
  });
});

describe('zoneFromPointer', () => {
  const rect = { top: 100, height: 40 };

  it('divide la riga in bordo alto, centro e bordo basso', () => {
    expect(zoneFromPointer(102, rect)).toBe('before');
    expect(zoneFromPointer(120, rect)).toBe('inside');
    expect(zoneFromPointer(138, rect)).toBe('after');
  });
});
