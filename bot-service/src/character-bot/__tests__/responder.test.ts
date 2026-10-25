import { test } from 'node:test';
import assert from 'node:assert/strict';
import PQueue from 'p-queue';
import { testBot } from './fixtures';
import { MemoryStore } from '../psyche/store';
import { BotResponder } from '../responder';
import type { HistoryLine } from '../prompt';

const make = (over: Record<string, unknown>, lines: HistoryLine[]) => {
  const bot = testBot({ debounceMs: 20, cooldownMs: 0, ...over });
  const posted: string[] = [];
  const positions: (string | undefined)[] = [];
  let generations = 0;
  const responder = new BotResponder(bot, {
    history: { recent: async () => lines } as never,
    ollama: { generate: async () => { generations++; return '*Alza lo sguardo.* Buonasera, straniero.'; }, generateJson: async () => ({ reaction: 'saluta', points: ['saluta'], tone: 'secco' }) },
    backend: { postMessage: async (p) => { posted.push(p.content); positions.push(p.position); return true; } },
    queue: new PQueue({ concurrency: 1 }),
    store: new MemoryStore(),
  });
  return { responder, posted, positions, generations: () => generations };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const player: HistoryLine = { characterId: 'p1', characterName: 'John', content: 'Buonasera' };

test('una raffica di messaggi produce una sola risposta', async () => {
  const t = make({}, [player]);
  t.responder.notify(); t.responder.notify(); t.responder.notify();
  await sleep(120);
  assert.equal(t.posted.length, 1, 'una raffica = una sola risposta pubblicata');
  assert.deepEqual(t.posted, ['*Alza lo sguardo.* Buonasera, straniero.']);
});

test('se l\'ultima battuta è già del bot non genera', async () => {
  const t = make({}, [player, { characterId: 'bot1', characterName: 'Mrs. Hargreave', content: 'Ciao' }]);
  t.responder.notify();
  await sleep(120);
  assert.equal(t.generations(), 0);
});

test('il cooldown rimanda la seconda risposta', async () => {
  const t = make({ cooldownMs: 150 }, [player]);
  t.responder.notify();
  await sleep(80);
  assert.equal(t.posted.length, 1);
  t.responder.notify();
  await sleep(60);
  assert.equal(t.posted.length, 1, 'ancora in cooldown');
  await sleep(200);
  assert.equal(t.posted.length, 2);
  t.responder.stop();
});

test('la risposta porta lo stesso tag di posizione del giocatore', async () => {
  const t = make({}, [{ ...player, position: 'Ingresso' }]);
  t.responder.notify();
  await sleep(120);
  assert.deepEqual(t.positions, ['Ingresso']);
});
