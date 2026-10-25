/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/botChat/utils/__tests__/knowledge.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LorePassage } from '@features/documenti/api';
import { buildChain, byProximity, proximity, type HierarchyNode } from '../proximity';
import { clipToSentence, LORE_MIN_COSINE, selectLore } from '../lorePassages';

const nodes = new Map<string, HierarchyNode>([
  ['london', { name: 'London', level: 'root' }],
  ['east', { name: 'East End', level: 'district', parent: 'london' }],
  ['whitechapel', { name: 'Whitechapel', level: 'quartiere', parent: 'east' }],
  ['spital', { name: 'Spitalfields', level: 'quartiere', parent: 'east' }],
  ['west', { name: 'West End', level: 'district', parent: 'london' }],
  ['mayfair', { name: 'Mayfair', level: 'quartiere', parent: 'west' }],
  ['suburbs', { name: 'Suburbs', level: 'district', parent: 'london' }],
  ['country', { name: 'Country Side', level: 'district', parent: 'london' }],
]);

describe('proximity', () => {
  const tenBells = buildChain('whitechapel', nodes);

  it('risale quartiere e distretto dal genitore', () => {
    assert.deepEqual(tenBells, { quartiere: { id: 'whitechapel', name: 'Whitechapel' }, district: { id: 'east', name: 'East End' } });
    assert.deepEqual(buildChain('suburbs', nodes), { district: { id: 'suburbs', name: 'Suburbs' } });
    assert.deepEqual(buildChain(undefined, nodes), {});
  });

  it('stesso quartiere = here, stesso distretto = near, altrove = far', () => {
    assert.equal(proximity(tenBells, buildChain('whitechapel', nodes)), 'here');
    assert.equal(proximity(tenBells, buildChain('spital', nodes)), 'near');
    assert.equal(proximity(tenBells, buildChain('mayfair', nodes)), 'far');
  });

  it('i distretti senza quartiere: stesso distretto = here', () => {
    assert.equal(proximity(buildChain('suburbs', nodes), buildChain('suburbs', nodes)), 'here');
    assert.equal(proximity(buildChain('suburbs', nodes), buildChain('country', nodes)), 'far');
  });

  it('un distretto conosciuto (dalla scheda del bot) diventa near, senza distinzione di maiuscole', () => {
    assert.equal(proximity(tenBells, buildChain('mayfair', nodes), ['west end']), 'near');
    assert.equal(proximity(tenBells, buildChain('mayfair', nodes), ['Country Side']), 'far');
  });

  it('ordina: il luogo corrente, poi here, near, far', () => {
    const list = [
      { n: 'far', proximity: 'far' as const }, { n: 'here', proximity: 'here' as const },
      { n: 'cur', proximity: 'here' as const, isCurrent: true }, { n: 'near', proximity: 'near' as const },
    ];
    assert.deepEqual(list.sort(byProximity).map((x) => x.n), ['cur', 'here', 'near', 'far']);
  });
});

const passage = (over: Partial<LorePassage>): LorePassage => ({
  documentId: 'd1', title: 'Storia di Londra', heading: 'I docks', text: 'I docks sono il cuore del commercio fluviale. Ogni giorno arrivano navi cariche di merci. '.repeat(3),
  vectorScore: 0.6, fullPath: '/ambientazione/storia#i-docks', ...over,
});

describe('selectLore', () => {
  it('sotto la soglia non è coperto e non passa nessun testo', () => {
    assert.deepEqual(selectLore([passage({ vectorScore: LORE_MIN_COSINE - 0.01 })]), { covered: false, passages: [] });
    assert.deepEqual(selectLore([]), { covered: false, passages: [] });
  });

  it('prende al massimo 2 passaggi, uno per documento, in ordine di coseno', () => {
    const lore = selectLore([
      passage({ documentId: 'a', vectorScore: 0.5 }), passage({ documentId: 'a', vectorScore: 0.7 }),
      passage({ documentId: 'b', title: 'Altro', vectorScore: 0.6 }), passage({ documentId: 'c', vectorScore: 0.45 }),
    ]);
    assert.equal(lore.covered, true);
    assert.deepEqual(lore.passages.map((p) => p.score), [0.7, 0.6]);
  });

  it('il testo è tagliato a una frase intera e rientra nel budget', () => {
    const lore = selectLore([passage({ text: 'Prima frase completa e lunga abbastanza. '.repeat(40) })]);
    const text = lore.passages[0]!.text;
    assert.ok(text.length <= 500);
    assert.ok(text.endsWith('.'), text.slice(-20));
  });

  it('clipToSentence non spezza una parola', () => {
    assert.equal(clipToSentence('Uno due tre quattro cinque sei sette', 18), 'Uno due tre…');
  });
});

describe('selectLore con testo di gioco', () => {
  it('scarta il passaggio di sole regole anche se ha il coseno più alto', () => {
    const meta = passage({ documentId: 'm', vectorScore: 0.9, text: 'Questo è un gioco di ruolo. I giocatori creano un personaggio. La scheda va compilata. Il regolamento spiega tutto.' });
    const lore = selectLore([meta, passage({ documentId: 'ok', vectorScore: 0.5 })]);
    assert.deepEqual(lore.passages.map((p) => p.score), [0.5]);
  });

  it('se resta solo testo di gioco non è coperto', () => {
    const meta = passage({ vectorScore: 0.9, text: 'Questo è un gioco di ruolo. I giocatori creano un personaggio. La scheda va compilata.' });
    assert.deepEqual(selectLore([meta]), { covered: false, passages: [] });
  });
});
