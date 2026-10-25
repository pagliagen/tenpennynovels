import { test } from 'node:test';
import assert from 'node:assert/strict';
import { psycheSchema } from '../config';
import {
  addFacts, applyPadDelta, applyRelationDelta, decayMood, initialMood, initialRelation, recordExchange,
  MAX_FACTS, MAX_PAD_DELTA, moodHalfLifeMs, validateIntroducedName,
} from '../psyche/dynamics';
import { describeMood, describePsyche, describeRelation, labelFor } from '../psyche/describe';

const psyche = psycheSchema.parse({
  ocean: { O: 35, C: 70, E: 30, A: 45, N: 25 },
  enneagram: { type: 6, fear: 'essere tradito o truffato', desire: 'sentirsi al sicuro tra gente fidata' },
  pad: { p: 0.1, a: -0.2, d: 0.4 },
});
const t0 = new Date('2026-10-17T18:00:00Z');
const later = (min: number) => new Date(t0.getTime() + min * 60_000);

test('i tratti estremi diventano frasi, quelli medi no; desiderio e paura ci sono sempre', () => {
  const lines = describePsyche(psyche);
  assert.ok(lines.some((l) => /metodico/.test(l)), 'C=70 → metodico');
  assert.ok(lines.some((l) => /poche parole/.test(l)), 'E=30 → laconico');
  assert.ok(lines.some((l) => /imperturbabile/.test(l)), 'N=25 → imperturbabile');
  assert.ok(!lines.some((l) => /diretto e brusco/.test(l)), 'A=45 è medio: nessuna frase');
  assert.ok(lines.some((l) => /sentirsi al sicuro/.test(l)));
  assert.ok(lines.some((l) => /tradito/.test(l)));
});

test('nessun numero della scheda arriva al modello', () => {
  assert.ok(describePsyche(psyche).every((l) => !/\d/.test(l)));
});

test('umore: ottanti PAD e neutralità', () => {
  assert.match(describeMood({ p: -0.6, a: 0.5, d: 0.5 }), /irritato e ostile/);
  assert.match(describeMood({ p: 0.5, a: -0.5, d: 0.5 }), /rilassato/);
  assert.equal(describeMood({ p: 0.05, a: -0.05, d: 0.1 }), 'Il tuo umore è neutro.');
});

test('l\'umore decade verso la base: dopo una half-life resta metà dello scarto', () => {
  const base = initialMood('b', psyche, t0);
  const angry = applyPadDelta(base, { p: -0.3, a: 0.3, d: 0 }, psyche, t0);
  const after = decayMood(angry, psyche, new Date(t0.getTime() + moodHalfLifeMs(psyche)));
  const gap = (x: number, b: number) => Math.abs(x - b);
  assert.ok(Math.abs(gap(after.pad.p, psyche.pad.p) - gap(angry.pad.p, psyche.pad.p) / 2) < 1e-9);
});

test('una variazione enorme proposta dall\'AI viene limitata', () => {
  const base = initialMood('b', psyche, t0);
  const m = applyPadDelta(base, { p: -5, a: 99, d: Number.NaN }, psyche, t0);
  assert.ok(Math.abs(m.pad.p - base.pad.p) <= MAX_PAD_DELTA * 1.0 + 1e-9);
  assert.equal(m.pad.d, base.pad.d, 'NaN vale zero');
  assert.ok(m.pad.a <= 1);
});

test('relazione: primo incontro, poi conteggi, tempo e nome', () => {
  const rel0 = initialRelation('b', 'p1', 'testuser', psyche, t0);
  assert.equal(rel0.interactions, 0);
  assert.equal(labelFor(rel0), 'Straniero', 'il nome vero della chat non filtra mai');
  assert.match(describeRelation(rel0, t0).join(' '), /prima volta/);

  const rel1 = recordExchange(applyRelationDelta(rel0, { trust: 4, respect: 0, suspicion: -3 }), later(1));
  assert.match(describeRelation(rel1, later(2)).join(' '), /una volta, poco fa/);
  assert.match(describeRelation(rel1, later(2)).join(' '), /non si è mai presentato/);

  const rel2 = recordExchange({ ...rel1, knownName: 'John' }, later(300));
  assert.equal(labelFor(rel2), 'John');
  const text = describeRelation(rel2, later(2000)).join(' ');
  assert.match(text, /2 volte/);
  assert.match(text, /si chiama John/);
  assert.match(text, /ieri|giorni/);
});

test('i punteggi di relazione restano in 0-100 e le variazioni sono limitate', () => {
  const rel = initialRelation('b', 'p1', 'x', psyche, t0);
  const up = applyRelationDelta({ ...rel, trust: 98 }, { trust: 500, respect: -500, suspicion: 0 });
  assert.equal(up.trust, 100);
  assert.ok(up.respect >= rel.respect - 10, 'max 10 punti per scambio');
});

test('lo sconosciuto di un bot gradevole si fida di più di quello di un bot scontroso', () => {
  const kind = psycheSchema.parse({ ...psyche, ocean: { ...psyche.ocean, A: 90 } });
  const harsh = psycheSchema.parse({ ...psyche, ocean: { ...psyche.ocean, A: 10 } });
  const k = initialRelation('b', 'p', 'x', kind, t0);
  const h = initialRelation('b', 'p', 'x', harsh, t0);
  assert.ok(k.trust > h.trust && k.suspicion < h.suspicion);
});

test('il nome vale solo se il giocatore lo ha scritto davvero', () => {
  const text = 'Mi chiamo John Harker, piacere.';
  assert.equal(validateIntroducedName('John', text), 'John');
  assert.equal(validateIntroducedName('Harker', text), 'Harker');
  assert.equal(validateIntroducedName('Edgar', text), null, 'allucinato');
  assert.equal(validateIntroducedName('J', text), null);
  assert.equal(validateIntroducedName(null, text), null);
  assert.equal(validateIntroducedName('<script>', '<script>'), null);
});

test('i fatti: dedup, scarto di quelli troppo corti o lunghi, massimo ' + MAX_FACTS, () => {
  let facts = addFacts([], ['È un marinaio', 'è un marinaio', 'ok', 'x'.repeat(200), 42]);
  assert.deepEqual(facts, ['è un marinaio'], 'il duplicato sostituisce il vecchio');
  const distinct = ['ama il rum', 'ha una cicatrice', 'porta un cappello', 'viene dal Galles', 'odia la polizia', 'ha un cane', 'fuma la pipa', 'tossisce spesso', 'deve soldi', 'canta male', 'è sordo', 'zoppica'];
  for (const f of distinct) facts = addFacts(facts, [f]);
  assert.equal(facts.length, MAX_FACTS);
  assert.equal(facts.at(-1), 'zoppica');
});

test('con spinte sempre positive la dominanza non satura a 1 (torna verso la base ad ogni scambio)', () => {
  let m = initialMood('b', psyche, t0);
  for (let i = 0; i < 40; i++) m = applyPadDelta(m, { p: 0, a: 0, d: 0.1 }, psyche, t0);
  assert.ok(m.pad.d < 1, `d=${m.pad.d}`);
  assert.ok(m.pad.d > psyche.pad.d, 'ma resta sopra la base');
});

test('un insulto sposta l\'umore verso «irritato», e l\'effetto passa', () => {
  let m = initialMood('b', psyche, t0);
  m = applyPadDelta(m, { p: -0.4, a: 0.3, d: 0 }, psyche, t0);
  assert.match(describeMood(m.pad), /irritato|teso|distaccato/);
  const calm = decayMood(m, psyche, new Date(t0.getTime() + 8 * 3600_000));
  assert.match(describeMood(calm.pad), /rilassato|neutro/);
});

test('un fatto che ripete in altre parole uno già noto lo sostituisce, non si accumula', () => {
  const facts = addFacts(['cerca lavoro al porto'], ['Cerca lavoro al porto di Londra']);
  assert.deepEqual(facts, ['Cerca lavoro al porto di Londra']);
  assert.equal(addFacts(['è un marinaio'], ['ha un cane nero']).length, 2);
});
