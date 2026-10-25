import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { createAdminRoutes } from '../admin';
import type { Llm } from '../../shared/ollama';

const LOC = 'a'.repeat(24);
const CHAR = 'b'.repeat(24);
const sheet = {
  name: 'Martha Quill', characterId: CHAR,
  persona: 'Sei una cameriera sbrigativa del locale e conosci tutti i clienti abituali del quartiere.',
  psyche: { ocean: { O: 40, C: 75, E: 55, A: 35, N: 50 }, enneagram: { type: 6, fear: 'restare sola', desire: 'un posto sicuro' }, pad: { p: -0.1, a: 0.2, d: 0.3 } },
};
const designBody = { description: 'una cameriera sbrigativa, vedova, che sa tutto del quartiere', location: { name: 'The Rusty Anchor' }, existingNames: [] };

function setup(over: { llm?: Llm; reload?: () => Promise<void> } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'admin-'));
  const calls = { reload: 0 };
  const routes = createAdminRoutes({
    paths: { botsDir: path.join(root, 'bots'), mappingFile: path.join(root, 'mapping.json') },
    llm: () => over.llm ?? { generate: async () => '', generateJson: async () => ({}) },
    reload: over.reload ?? (async () => { calls.reload++; }),
    loaded: () => new Set([CHAR]),
  });
  return { routes, calls, root };
}

test('list: vuoto da zero; dopo register il bot compare e risulta attivo se caricato', async () => {
  const { routes } = setup();
  assert.deepEqual((await routes.list({})).body, { bots: [] });
  assert.equal((await routes.register({ locationId: LOC, sheet })).status, 200);
  const listed = (await routes.list({})).body as { bots: { name: string; active: boolean; locationId: string }[] };
  assert.deepEqual(listed.bots.map((b) => [b.name, b.active, b.locationId]), [['Martha Quill', true, LOC]]);
});

test('register: scrive, ricarica una volta e lo dice; errori in codici chiari', async () => {
  const { routes, calls } = setup();
  const ok = await routes.register({ locationId: LOC, sheet });
  assert.deepEqual(ok.body, { file: 'martha-quill.json', characterId: CHAR, reloaded: true });
  assert.equal(calls.reload, 1);
  const dup = await routes.register({ locationId: LOC, sheet: { ...sheet, name: 'Ruth Vane', characterId: 'c'.repeat(24) } });
  assert.equal(dup.status, 409);
  assert.equal((dup.body as { code: string }).code, 'location-taken');
  assert.equal((await routes.register({ locationId: 'x', sheet })).status, 400);
  assert.equal((await routes.register('non un oggetto')).status, 400);
  assert.equal(calls.reload, 1, 'un register rifiutato non ricarica');
});

test('register: se la ricarica fallisce il bot esiste lo stesso e la risposta lo dice', async () => {
  const { routes, root } = setup({ reload: async () => { throw new Error('Redis giù'); } });
  const r = await routes.register({ locationId: LOC, sheet });
  assert.equal(r.status, 200);
  assert.equal((r.body as { reloaded: boolean }).reloaded, false);
  assert.ok(existsSync(path.join(root, 'bots', 'martha-quill.json')));
});

test('design: richiesta non valida = 400 senza chiamare il modello; modello giù = 502 generico', async () => {
  let calls = 0;
  const { routes } = setup({ llm: { generate: async () => '', generateJson: async () => { calls++; throw new Error('segreto di Ollama'); } } });
  assert.equal((await routes.design({ description: 'corta', location: { name: 'X' } })).status, 400);
  assert.equal(calls, 0);
  const down = await routes.design(designBody);
  assert.equal(down.status, 502);
  assert.doesNotMatch(JSON.stringify(down.body), /segreto/);
});

test('design: una generazione alla volta (429 la seconda)', async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => { release = r; });
  const { routes } = setup({ llm: { generate: async () => '', generateJson: async () => { await gate; return {}; } } });
  const first = routes.design(designBody);
  const second = await routes.design(designBody);
  assert.equal(second.status, 429);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await routes.design(designBody)).status, 200, 'dopo la fine si può rifare');
});
