import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testBot } from './fixtures';
import { MemoryStore } from '../psyche/store';
import { applyAppraisal, finishTurn, loadTurnState, playerTextSinceLastReply, type TurnState } from '../psyche/turn';
import { buildPsycheLines } from '../psyche/blocks';
import type { Llm } from '../ollama';
import type { Appraisal } from '../psyche/appraise';
import type { TurnContext } from '../pipeline/types';
import type { HistoryLine } from '../prompt';

const bot = testBot();
const now = new Date('2026-10-17T18:00:00Z');
const player = (content: string, id = 'p1', name = 'testuser'): HistoryLine => ({ characterId: id, characterName: name, content, position: 'Bancone' });
const own = (content: string): HistoryLine => ({ characterId: bot.characterId, characterName: bot.name, content });

const llm = (json: unknown = { summary: 'Ha chiesto da bere e si è comportato bene.' }): Llm => ({
  generate: async () => '',
  generateJson: async () => json,
});

const appraisal = (over: Partial<Appraisal> = {}): Appraisal => ({ events: [], introducedName: null, facts: [], ...over });

const ctxFor = (state: TurnState): TurnContext => ({
  bot, history: state.history, previousOwn: [], knownText: '', psyche: bot.psyche,
  mood: state.effectiveMood, relation: state.relation,
  psycheLines: buildPsycheLines({
    psyche: bot.psyche, mood: state.effectiveMood, relation: state.relation, stance: state.stance,
    appearance: state.appearance, ...(state.knownName ? { name: state.knownName } : {}), now: state.now, others: state.others,
  }),
  ...(state.knownName ? { otherName: state.knownName } : {}),
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

test('se si presenta, il bot lo sa GIÀ mentre risponde (prima era una battuta in ritardo)', async () => {
  const store = new MemoryStore();
  const raw = [player('Mi chiamo John Harker. Sono un marinaio.')];
  const s0 = (await loadTurnState(store, bot, raw, now))!;
  await applyAppraisal(store, bot, s0, appraisal({ introducedName: 'John', facts: ['è un marinaio'] }), raw[0]!.content);

  const s1 = (await loadTurnState(store, bot, raw, now))!;
  assert.equal(s1.history[0]!.characterName, 'John');
  assert.equal(s1.relation!.interactions, 0, 'lo scambio non è ancora avvenuto');
  const text = ctxFor(s1).psycheLines.join('\n');
  assert.match(text, /Ha appena detto di chiamarsi John/);
  assert.match(text, /è un marinaio/);
});

test('dopo la risposta lo scambio si conta, e la volta dopo «già incontrato»', async () => {
  const store = new MemoryStore();
  const raw = [player('Un gin, grazie.')];
  const s0 = (await loadTurnState(store, bot, raw, now))!;
  await applyAppraisal(store, bot, s0, appraisal({ events: [{ type: 'gentilezza', intensity: 2 }] }), raw[0]!.content);
  const s1 = (await loadTurnState(store, bot, raw, now))!;
  await finishTurn(store, llm(), ctxFor(s1), s1, 'Ecco.');

  const saved = (await store.getRelations(bot.characterId, ['p1'])).get('p1')!;
  assert.equal(saved.interactions, 1);
  const s2 = (await loadTurnState(store, bot, [...raw, own('Ecco.'), player('Un altro.')], new Date(now.getTime() + 60_000)))!;
  assert.match(ctxFor(s2).psycheLines.join('\n'), /una volta, poco fa/);
});

test('un nome che l\'AI inventa non diventa mai ciò che il bot sa', async () => {
  const store = new MemoryStore();
  const raw = [player('Un tè nero, grazie.')];
  const s0 = (await loadTurnState(store, bot, raw, now))!;
  await applyAppraisal(store, bot, s0, appraisal({ introducedName: 'Edgar' }), raw[0]!.content);
  const saved = (await store.getRelations(bot.characterId, ['p1'])).get('p1')!;
  assert.equal(saved.knownName, undefined);
});

test('se l\'analisi AI fallisce (null) la risposta non si blocca e il rapporto si crea comunque', async () => {
  const store = new MemoryStore();
  const raw = [player('Buonasera')];
  const s0 = (await loadTurnState(store, bot, raw, now))!;
  await applyAppraisal(store, bot, s0, null, raw[0]!.content);
  const s1 = (await loadTurnState(store, bot, raw, now))!;
  await finishTurn(store, llm(), ctxFor(s1), s1, 'Salve.');

  assert.equal((await store.getRelations(bot.characterId, ['p1'])).get('p1')!.interactions, 1);
  assert.ok(await store.getMood(bot.characterId));
});

test('un insulto cambia l\'umore PRIMA della risposta, e il prompt lo dice', async () => {
  const store = new MemoryStore();
  const raw = [player('Questo gin è una schifezza, vecchio imbroglione!')];
  const s0 = (await loadTurnState(store, bot, raw, now))!;
  const before = s0.effectiveMood.p;
  await applyAppraisal(store, bot, s0, appraisal({ events: [{ type: 'insulto', intensity: 3 }] }), raw[0]!.content);
  const s1 = (await loadTurnState(store, bot, raw, now))!;
  assert.ok(s1.effectiveMood.p < before - 0.15, `p ${before} -> ${s1.effectiveMood.p}`);
  assert.match(ctxFor(s1).psycheLines.join('\n'), /cattivo umore|irritato|teso|distaccato/);
  assert.equal(s1.relation!.lastEvent, 'lo ha offeso');
});

test('l\'umore decade tra un turno e l\'altro', async () => {
  const store = new MemoryStore();
  const raw = [player('Questo gin è annacquato!')];
  const s1 = (await loadTurnState(store, bot, raw, now))!;
  await applyAppraisal(store, bot, s1, appraisal({ events: [{ type: 'insulto', intensity: 2 }] }), raw[0]!.content);

  const hist = [...raw, own('Fuori.'), player('Scusa.')];
  const soon = (await loadTurnState(store, bot, hist, new Date(now.getTime() + 60_000)))!;
  const later = (await loadTurnState(store, bot, hist, new Date(now.getTime() + 6 * 3600_000)))!;
  const gap = (m: { p: number }) => Math.abs(m.p - bot.psyche.pad.p);
  assert.ok(gap(soon.mood.pad) > gap(later.mood.pad), 'dopo 6 ore l\'umore è tornato quasi alla base');
});

test('il riassunto si aggiorna ogni 3 scambi e se fallisce resta il vecchio', async () => {
  const store = new MemoryStore();
  let history: HistoryLine[] = [];
  for (let i = 1; i <= 3; i++) {
    history = [...history, player(`Messaggio ${i}`)];
    const t = new Date(now.getTime() + i * 60_000);
    const s0 = (await loadTurnState(store, bot, history, t))!;
    await applyAppraisal(store, bot, s0, appraisal(), 'x');
    const s1 = (await loadTurnState(store, bot, history, t))!;
    await finishTurn(store, i === 3 ? llm() : llm({ summary: '' }), ctxFor(s1), s1, `Risposta ${i}`);
    history = [...history, own(`Risposta ${i}`)];
  }
  const saved = (await store.getRelations(bot.characterId, ['p1'])).get('p1')!;
  assert.equal(saved.interactions, 3);
  assert.match(saved.summary ?? '', /ha chiesto da bere/i);
});

test('playerTextSinceLastReply prende solo ciò che l\'interlocutore ha scritto dopo il bot', () => {
  const h = [player('vecchio'), own('r'), player('uno'), player('altro', 'p2'), player('due')];
  assert.equal(playerTextSinceLastReply(h, bot.characterId, 'p1'), 'uno due');
});
