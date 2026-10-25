import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testBot } from './fixtures';
import { resolveStance, effectivePad } from '../psyche/stance';
import { describeAppearance, ageBandOf, ageImpression } from '../psyche/appearance';
import { describeRelation, labelFor } from '../psyche/describe';
import { initialRelation } from '../psyche/dynamics';
import { outcomeOf } from '../psyche/events';
import { MemoryStore } from '../psyche/store';
import { loadTurnState } from '../psyche/turn';
import type { Appearance } from '../psyche/types';

const bot = testBot({
  relationships: [
    { characterId: 'sis', label: 'tua sorella minore', backstory: 'Ti ha aiutato ad aprire la locanda.', trust: 90, respect: 70, suspicion: 5, moodOffset: { p: 0.3, a: -0.1 }, hint: 'Con lei abbassi la guardia.' },
    { characterId: 'rival', label: 'il rivale che ti deve soldi', trust: 10, suspicion: 90, moodOffset: { p: -0.4, a: 0.3 }, knowsName: true },
  ],
  attitudes: [
    { match: { appearsLike: ['uniforme'] }, suspicionShift: 25, trustShift: -15, moodOffset: { a: 0.1, d: -0.1 }, hint: 'Diffidi della polizia.' },
    { match: { ageBand: 'young', gender: 'female' }, trustShift: 10 },
  ],
});
const now = new Date('2026-10-17T18:00:00Z');
const cop: Appearance = { gender: 'male', apparentAge: 41, physicalDescription: 'Indossa una uniforme blu da agente.' };

test('un rapporto autorato dà punteggi, etichetta, nome noto e un effetto sull\'umore', () => {
  const st = resolveStance(bot, 'sis', null);
  assert.equal(st.authored, true);
  assert.equal(st.knowsName, true);
  assert.deepEqual(st.initial, { trust: 90, respect: 70, suspicion: 5 });
  assert.equal(st.moodOffset.p, 0.3);
  const rel = initialRelation(bot.characterId, 'sis', 'Annie', bot.psyche, now, st);
  assert.equal(rel.trust, 90);
  assert.equal(rel.interactions, 0);
});

test('con un rapporto autorato non si è «prima volta» e il nome è quello della chat', () => {
  const st = resolveStance(bot, 'sis', null);
  const text = describeRelation(null, now, st, 'Annie', 'female').join(' ');
  assert.doesNotMatch(text, /prima volta/);
  assert.match(text, /Sai che si chiama Annie/);
  assert.match(text, /tua sorella minore/);
  assert.equal(labelFor(null, st, 'Annie'), 'Annie');
  assert.equal(labelFor(null, resolveStance(bot, 'zz', null), 'Zed'), 'Straniero');
});

test('le categorie scattano da ciò che si vede e spostano i punteggi di partenza', () => {
  const none = resolveStance(bot, 'x', { gender: 'male', apparentAge: 41 });
  assert.equal(none.shift.suspicion, 0);
  const st = resolveStance(bot, 'x', cop);
  assert.equal(st.authored, false);
  assert.equal(st.shift.suspicion, 25);
  assert.deepEqual(st.hints, ['Diffidi della polizia.']);
  const base = initialRelation(bot.characterId, 'x', 'Tom', bot.psyche, now);
  const rel = initialRelation(bot.characterId, 'x', 'Tom', bot.psyche, now, st);
  assert.equal(rel.suspicion, Math.min(100, base.suspicion + 25));
  assert.ok(rel.trust < base.trust);
  assert.equal(resolveStance(bot, 'y', { gender: 'female', apparentAge: 22 }).shift.trust, 10);
});

test('l\'umore con una persona è quello di fondo più il suo effetto, entro -1..1', () => {
  const rival = resolveStance(bot, 'rival', null);
  const eff = effectivePad({ p: 0.1, a: -0.2, d: 0.4 }, rival);
  assert.ok(eff.p < 0 && eff.a > -0.2);
  assert.equal(effectivePad({ p: 0.9, a: 0, d: 0 }, resolveStance(bot, 'sis', null)).p, 1);
});

test('l\'aspetto: età a occhio (mai il numero), genere e segni; nessun dato = niente', () => {
  assert.deepEqual(describeAppearance(null), []);
  assert.match(ageImpression(22, 'un uomo'), /una ventina d'anni/);
  assert.doesNotMatch(describeAppearance({ gender: 'female', apparentAge: 34 }).join(' '), /34/);
  assert.match(describeAppearance({ gender: 'female', apparentAge: 34 }).join(' '), /una donna di una trentina d'anni/);
  assert.match(ageImpression(15, 'una donna'), /ragazzina/);
  assert.equal(ageBandOf(20), 'young');
  assert.equal(ageBandOf(undefined), undefined);
  assert.match(describeAppearance({ physicalDescription: 'Capelli rossi', visibleMarks: 'cicatrice sul mento' }).join(' '), /cicatrice sul mento/);
});

test('dalla scheda al caricamento del turno: rivale riconosciuto per id, sconosciuto resta Straniero', async () => {
  const store = new MemoryStore();
  const hist = [
    { characterId: 'rival', characterName: 'Jack Dunne', content: 'Barnaby.' },
    { characterId: 'zed', characterName: 'Zed', content: 'Buonasera.', position: 'Bancone' },
  ];
  const lookup = async (id: string) => (id === 'zed' ? cop : null);
  const st = (await loadTurnState(store, bot, hist, now, lookup))!;
  assert.equal(st.history[0]!.characterName, 'Jack Dunne');
  assert.equal(st.history[1]!.characterName, 'Straniero');
  assert.equal(st.stance.shift.suspicion, 25, 'la categoria vale per chi ha davanti');
  assert.ok(st.others.some((o) => o.includes('Jack Dunne') && o.includes('rivale')), 'il rivale presente è segnalato');
});

test('eventi → variazioni: l\'insulto ferisce più chi si fidava, la gentilezza di un sospettato pesa meno', () => {
  const friend = outcomeOf([{ type: 'insulto', intensity: 2 }], { trust: 80, suspicion: 10 }, bot.psyche);
  const stranger = outcomeOf([{ type: 'insulto', intensity: 2 }], { trust: 40, suspicion: 50 }, bot.psyche);
  assert.ok(friend.relation.trust < stranger.relation.trust);
  const kindFromSuspect = outcomeOf([{ type: 'gentilezza', intensity: 2 }], { trust: 20, suspicion: 80 }, bot.psyche);
  const kindFromNeutral = outcomeOf([{ type: 'gentilezza', intensity: 2 }], { trust: 40, suspicion: 50 }, bot.psyche);
  assert.ok(kindFromSuspect.relation.trust < kindFromNeutral.relation.trust);
  assert.equal(outcomeOf([{ type: 'minaccia', intensity: 3 }], null, bot.psyche).memory, 'lo ha minacciato');
  assert.deepEqual(outcomeOf([], null, bot.psyche).pad, { p: 0, a: 0, d: 0 });
});
