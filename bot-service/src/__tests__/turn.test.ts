import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testBot } from './fixtures';
import { MemoryStore } from '../psyche/store';
import { commitTurn, loadTurnState } from '../psyche/turn';
import { buildPsycheLines } from '../psyche/blocks';
import type { Llm } from '../ollama';
import type { TurnContext } from '../pipeline/types';
import type { HistoryLine } from '../prompt';

const bot = testBot();
const now = new Date('2026-10-17T18:00:00Z');
const player = (content: string, id = 'p1', name = 'testuser'): HistoryLine => ({ characterId: id, characterName: name, content, position: 'Bancone' });
const own = (content: string): HistoryLine => ({ characterId: bot.characterId, characterName: bot.name, content });

/** Un LLM finto che risponde all'analisi con quanto gli si dice. */
const llm = (analysis: unknown): Llm => ({
  generate: async () => '',
  generateJson: async () => analysis,
});

const ctxFor = (state: NonNullable<Awaited<ReturnType<typeof loadTurnState>>>): TurnContext => ({
  bot, history: state.history, previousOwn: [], knownText: '', psyche: bot.psyche,
  mood: state.mood.pad, relation: state.relation, now: state.now,
  psycheLines: buildPsycheLines(bot.psyche, state.mood.pad, state.relation, state.now),
});

test('chi non si è presentato è «Straniero» per il bot, anche se il suo nome è in chat', async () => {
  const store = new MemoryStore();
  const state = await loadTurnState(store, bot, [player('Buonasera')], now);
  assert.ok(state);
  assert.equal(state.history[0]!.characterName, 'Straniero');
  assert.equal(state.relation, null);
  assert.match(ctxFor(state).psycheLines.join('\n'), /prima volta/);
});

test('niente da fare se la storia è vuota o l\'ultima battuta è del bot', async () => {
  const store = new MemoryStore();
  assert.equal(await loadTurnState(store, bot, [], now), null);
  assert.equal(await loadTurnState(store, bot, [player('Ciao'), own('Prego')], now), null);
});

test('dopo lo scambio: conteggio, nome presentato e fatti vengono salvati; la volta dopo si usa il nome', async () => {
  const store = new MemoryStore();
  const raw = [player('Mi chiamo John Harker. Sono un marinaio.')];
  const state = (await loadTurnState(store, bot, raw, now))!;

  await commitTurn(store, llm({
    mood: { pleasure: 0.2, arousal: 0, dominance: 0 },
    relation: { trust: 5, respect: 3, suspicion: -2 },
    introducedName: 'John',
    facts: ['è un marinaio'],
  }), ctxFor(state), state, raw, 'Benvenuto.');

  const saved = (await store.getRelations(bot.characterId, ['p1'])).get('p1')!;
  assert.equal(saved.interactions, 1);
  assert.equal(saved.knownName, 'John');
  assert.deepEqual(saved.facts, ['è un marinaio']);
  assert.ok(saved.trust > 35);

  const next = (await loadTurnState(store, bot, [...raw, own('Benvenuto.'), player('Un gin.')], new Date(now.getTime() + 60_000)))!;
  assert.equal(next.history[0]!.characterName, 'John', 'ora il bot sa come si chiama');
  assert.match(ctxFor(next).psycheLines.join('\n'), /si chiama John/);
});

test('un nome che l\'AI inventa non diventa mai ciò che il bot sa', async () => {
  const store = new MemoryStore();
  const raw = [player('Un tè nero, grazie.')];
  const state = (await loadTurnState(store, bot, raw, now))!;

  await commitTurn(store, llm({
    mood: { pleasure: 0, arousal: 0, dominance: 0 }, relation: { trust: 0, respect: 0, suspicion: 0 },
    introducedName: 'Edgar', facts: [],
  }), ctxFor(state), state, raw, 'Ecco.');

  const saved = (await store.getRelations(bot.characterId, ['p1'])).get('p1')!;
  assert.equal(saved.knownName, undefined);
  assert.equal(saved.interactions, 1, 'lo scambio si conta comunque');
});

test('se l\'analisi AI fallisce, la parte deterministica si salva lo stesso', async () => {
  const store = new MemoryStore();
  const raw = [player('Buonasera')];
  const state = (await loadTurnState(store, bot, raw, now))!;
  const broken: Llm = { generate: async () => '', generateJson: async () => { throw new Error('json rotto'); } };

  await commitTurn(store, broken, ctxFor(state), state, raw, 'Salve.');

  const saved = (await store.getRelations(bot.characterId, ['p1'])).get('p1')!;
  assert.equal(saved.interactions, 1);
  assert.ok(await store.getMood(bot.characterId));
});

test('l\'umore decade tra un turno e l\'altro', async () => {
  const store = new MemoryStore();
  const raw = [player('Questo gin è annacquato!')];
  const s1 = (await loadTurnState(store, bot, raw, now))!;
  await commitTurn(store, llm({
    mood: { pleasure: -0.3, arousal: 0.3, dominance: 0 }, relation: { trust: -5, respect: -5, suspicion: 5 },
    introducedName: null, facts: [],
  }), ctxFor(s1), s1, raw, 'Fuori.');

  const soon = (await loadTurnState(store, bot, [...raw, own('Fuori.'), player('Scusa.')], new Date(now.getTime() + 60_000)))!;
  const later = (await loadTurnState(store, bot, [...raw, own('Fuori.'), player('Scusa.')], new Date(now.getTime() + 6 * 3600_000)))!;
  const gap = (m: { p: number }) => Math.abs(m.p - bot.psyche.pad.p);
  assert.ok(gap(soon.mood.pad) > gap(later.mood.pad), 'dopo 6 ore l\'umore è tornato quasi alla base');
});
