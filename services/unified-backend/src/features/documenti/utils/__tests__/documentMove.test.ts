/**
 * Test delle regole di spostamento documenti. Si eseguono con il runner nativo
 * di Node (il repo non ha jest/vitest nel backend):
 *
 *   cd services/unified-backend
 *   npx tsx --test src/features/documenti/utils/__tests__/documentMove.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_DOCUMENT_DEPTH,
  placeAmongSiblings,
  validateReparent,
  type DocumentNodeLite
} from '../documentMove';

function tree(
  entries: Array<[id: string, parentId: string | null, subtypeId?: string, type?: string]>
): Map<string, DocumentNodeLite> {
  return new Map(
    entries.map(([id, parentId, subtypeId = 's1', type = 'ambientazione']) => [
      id,
      { id, parentId, subtypeId, type }
    ])
  );
}

describe('validateReparent', () => {
  it('permette di rendere radice un figlio (caso "Lower Class")', () => {
    const nodes = tree([['classi', null], ['lower', 'classi']]);
    assert.equal(validateReparent(nodes, 'lower', null), null);
  });

  it('permette di far diventare figlio di un altro documento', () => {
    const nodes = tree([['classi', null], ['lower', null], ['altro', null]]);
    assert.equal(validateReparent(nodes, 'lower', 'altro'), null);
  });

  it('rifiuta un documento figlio di se stesso', () => {
    const nodes = tree([['a', null]]);
    assert.equal(validateReparent(nodes, 'a', 'a'), 'SELF_PARENT');
  });

  it('rifiuta il ciclo diretto e quello indiretto', () => {
    const nodes = tree([['a', null], ['b', 'a'], ['c', 'b']]);
    assert.equal(validateReparent(nodes, 'a', 'b'), 'CYCLE');
    assert.equal(validateReparent(nodes, 'a', 'c'), 'CYCLE');
  });

  it('non va in loop se i dati contengono già un ciclo', () => {
    const nodes = tree([['x', 'y'], ['y', 'x'], ['a', null]]);
    assert.equal(validateReparent(nodes, 'a', 'x'), 'CYCLE');
  });

  it('rifiuta un padre di un altro sottotipo', () => {
    const nodes = tree([['a', null, 's1'], ['b', null, 's2']]);
    assert.equal(validateReparent(nodes, 'a', 'b'), 'SUBTYPE_MISMATCH');
  });

  it('rifiuta un padre di un altro tipo', () => {
    const nodes = tree([['a', null, 's1', 'ambientazione'], ['b', null, 's1', 'regolamento']]);
    assert.equal(validateReparent(nodes, 'a', 'b'), 'TYPE_MISMATCH');
  });

  it('rifiuta un padre inesistente e un documento inesistente', () => {
    const nodes = tree([['a', null]]);
    assert.equal(validateReparent(nodes, 'a', 'fantasma'), 'PARENT_NOT_FOUND');
    assert.equal(validateReparent(nodes, 'fantasma', null), 'DOCUMENT_NOT_FOUND');
  });

  it('conta anche il sottoalbero trascinato nel limite di profondità', () => {
    // catena radice→…→foglia lunga esattamente MAX_DOCUMENT_DEPTH livelli
    const chain: Array<[string, string | null]> = [['n0', null]];
    for (let i = 1; i <= MAX_DOCUMENT_DEPTH; i++) chain.push([`n${i}`, `n${i - 1}`]);
    // 'blocco' ha un figlio: spostarlo sotto la foglia supererebbe il limite
    const nodes = tree([...chain, ['blocco', null], ['figlio', 'blocco']]);

    assert.equal(validateReparent(nodes, 'blocco', `n${MAX_DOCUMENT_DEPTH}`), 'TOO_DEEP');
    // sotto un nodo più alto entra
    assert.equal(validateReparent(nodes, 'blocco', 'n1'), null);
  });
});

describe('placeAmongSiblings', () => {
  it('inserisce prima del fratello indicato', () => {
    assert.deepEqual(placeAmongSiblings(['a', 'b', 'c'], 'x', 'b'), ['a', 'x', 'b', 'c']);
  });

  it('mette in coda con beforeId null', () => {
    assert.deepEqual(placeAmongSiblings(['a', 'b'], 'x', null), ['a', 'b', 'x']);
  });

  it('sposta un fratello già presente senza duplicarlo', () => {
    assert.deepEqual(placeAmongSiblings(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
    assert.deepEqual(placeAmongSiblings(['a', 'b', 'c'], 'a', null), ['b', 'c', 'a']);
  });

  it('rifiuta un beforeId che non è fra i fratelli di destinazione', () => {
    assert.equal(placeAmongSiblings(['a', 'b'], 'x', 'zzz'), null);
    // né può essere il documento stesso
    assert.equal(placeAmongSiblings(['a', 'x'], 'x', 'x'), null);
  });
});
