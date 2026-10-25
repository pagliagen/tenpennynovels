/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/editorial/__tests__/canonRules.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findAnachronisms } from '../utils/anachronisms';
import {
  buildCanonReport, detectCanonYear, findDuplicateTitles, findEmptyDocuments, findShortLocations, findSlugYearTypos, findYearMismatches,
  type CanonInput, type ReviewDocument,
} from '../utils/canonRules';

const doc = (over: Partial<ReviewDocument> & { _id: string }): ReviewDocument => ({
  title: 'Doc', slug: 'doc', type: 'ambientazione', isDraft: false, text: 'x'.repeat(200), ...over,
});

/** Un canone come quello vero: il 1895 domina, qualche anno storico sparso. */
const lore = doc({ _id: 'd1', title: 'Lore', text: 'Nel 1895 Londra è una città viva. Nel 1895 il fumo copre tutto. Il 1895 è un anno di contrasti. La regina sale al trono nel 1837 e regna fino al 1901.' });

const input = (over: Partial<CanonInput> = {}): CanonInput => ({ documents: [lore], subtypes: [], locations: [], ...over });

describe('detectCanonYear', () => {
  it('prende l\'anno più citato, ignorando i riferimenti storici isolati', () => {
    assert.equal(detectCanonYear([lore]), 1895);
  });

  it('senza un anno prevalente (meno di 3 citazioni) non decide', () => {
    assert.equal(detectCanonYear([doc({ _id: 'x', text: 'Nel 1837 e nel 1895 accadde qualcosa.' })]), null);
  });

  it('conta solo i documenti di ambientazione', () => {
    assert.equal(detectCanonYear([doc({ _id: 'r', type: 'regolamento', text: '1888 1888 1888 1888' })]), null);
  });
});

describe('findYearMismatches', () => {
  it('trova l\'anno vicino ma diverso nelle location (il caso reale: 1889 contro 1895)', () => {
    const findings = findYearMismatches(1895, input({
      locations: [{ _id: 'l1', name: 'London', description: "La grande metropoli dell'Impero Britannico nell'anno 1889. Una città di contrasti.", locationLevel: 'root' }],
    }));
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.targets[0]!.label, 'London');
    assert.match(findings[0]!.targets[0]!.excerpt!, /1889/);
  });

  it('non segnala il canone stesso né gli anni lontani (storia)', () => {
    const findings = findYearMismatches(1895, input({
      locations: [
        { _id: 'a', name: 'A', description: 'Fondata nel 1666 dopo il grande incendio.', locationLevel: 'location' },
        { _id: 'b', name: 'B', description: 'Nel 1895 era già così.', locationLevel: 'location' },
      ],
    }));
    assert.deepEqual(findings, []);
  });

  it('nei documenti conta solo l\'anno detto come «presente» («nell\'anno 1889»)', () => {
    const history = doc({ _id: 'h', text: 'La regina nasce nel 1819 e nel 1887 festeggia il giubileo. '.repeat(3) });
    const wrong = doc({ _id: 'w', title: 'Sbagliato', text: "Siamo nell'anno 1889 e tutto cambia. ".repeat(2) });
    const findings = findYearMismatches(1895, input({ documents: [lore, history, wrong] }));
    assert.deepEqual(findings[0]!.targets.map((t) => t.label), ['Sbagliato', 'Sbagliato']);
  });
});

describe('findSlugYearTypos', () => {
  it('trova le cifre scambiate nello slug (londra-1985 al posto di londra-1895)', () => {
    const findings = findSlugYearTypos(1895, input({ subtypes: [{ _id: 's1', slug: 'londra-1985', title: 'Londra 1985', type: 'ambientazione' }] }));
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.targets[0]!.kind, 'subtype');
    assert.match(findings[0]!.detail, /redirect/);
  });

  it('non segnala slug corretti o con numeri qualsiasi', () => {
    const subtypes = [
      { _id: 'a', slug: 'londra-1895', title: 'Londra 1895', type: 'ambientazione' },
      { _id: 'b', slug: 'regole-2020', title: 'Regole', type: 'regolamento' },
    ];
    assert.deepEqual(findSlugYearTypos(1895, input({ subtypes })), []);
  });
});

describe('anacronismi', () => {
  it('trova le parole che nel 1895 non esistono, con la frase intorno', () => {
    const hits = findAnachronisms('Il telegrafo funziona, ma nessuno ha un cellulare o un computer in tasca.');
    assert.deepEqual(hits.map((h) => h.word), ['cellulare', 'computer']);
    assert.match(hits[0]!.excerpt, /cellulare/);
  });

  it('non scambia parole più lunghe e non segnala ciò che nel 1895 c\'era', () => {
    assert.deepEqual(findAnachronisms('Il telefono squilla; l\'aeroplanino di carta vola; un\'automobile passa. Il cinematografo debutta.'), []);
  });
});

describe('documenti e location sottili', () => {
  it('segnala i documenti vuoti, distinguendo le bozze', () => {
    const findings = findEmptyDocuments(input({ documents: [lore, doc({ _id: 'e', title: 'primo strato', text: '', isDraft: false })] }));
    assert.equal(findings[0]!.targets[0]!.label, 'primo strato');
    assert.equal(findings[0]!.targets[0]!.excerpt, '0 caratteri');
  });

  it('raggruppa le location con descrizione breve in un solo rilievo (solo le foglie)', () => {
    const locations = [
      { _id: '1', name: 'Ten Bells', description: 'Una taverna popolare.', locationLevel: 'location' },
      { _id: '2', name: 'Whitechapel', description: 'Breve.', locationLevel: 'quartiere' },
      { _id: '3', name: 'Lunga', description: 'x'.repeat(200), locationLevel: 'location' },
    ];
    const findings = findShortLocations(input({ locations }));
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0]!.targets.map((t) => t.label), ['Ten Bells']);
  });

  it('trova i titoli duplicati nello stesso tipo, ignorando accenti e punteggiatura', () => {
    const findings = findDuplicateTitles(input({ documents: [doc({ _id: 'a', title: 'La città' }), doc({ _id: 'b', title: 'La citta!' }), doc({ _id: 'c', type: 'regolamento', title: 'La città' })] }));
    assert.deepEqual(findings[0]!.targets.map((t) => t.id), ['a', 'b']);
  });
});

describe('buildCanonReport', () => {
  it('mette i rilievi in ordine di gravità e conta tutto', () => {
    const report = buildCanonReport(input({
      documents: [lore, doc({ _id: 'e', title: 'Vuoto', text: '' })],
      subtypes: [{ _id: 's1', slug: 'londra-1985', title: 'Londra 1985', type: 'ambientazione' }],
      locations: [{ _id: 'l1', name: 'London', description: 'Nell\'anno 1889 la città respira.', locationLevel: 'root' }, { _id: 'l2', name: 'Breve', description: 'Corta.', locationLevel: 'location' }],
    }));
    assert.equal(report.canonYear, 1895);
    assert.deepEqual(report.findings.map((f) => f.code), ['year-mismatch', 'slug-year-typo', 'empty-document', 'short-location']);
    assert.equal(report.stats.findings, 4);
  });

  it('un DB pulito dà un rapporto vuoto', () => {
    const clean = buildCanonReport(input({ locations: [{ _id: 'l', name: 'Ok', description: 'x'.repeat(200), locationLevel: 'location' }] }));
    assert.deepEqual(clean.findings, []);
  });

  it('senza canone prevalente salta i controlli sugli anni ma non gli altri', () => {
    const report = buildCanonReport(input({ documents: [doc({ _id: 'e', text: '' })] }));
    assert.equal(report.canonYear, null);
    assert.deepEqual(report.findings.map((f) => f.code), ['empty-document']);
  });
});
