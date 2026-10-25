import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createHttpServer } from '../server';
import { parseEnabledServices, type AiService } from '../service';

const service = (name: AiService['name'], ok: boolean, routes?: AiService['routes']): AiService => ({
  name, start: async () => {}, stop: async () => {}, health: async () => (ok ? { ok } : { ok, reason: 'giù' }), ...(routes ? { routes } : {}),
});

async function withServer<T>(services: AiService[], fn: (base: string) => Promise<T>): Promise<T> {
  const server = createHttpServer(services);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('ENABLED_SERVICES: vuoto = nessuno, doppioni tolti, nome sconosciuto = errore', () => {
  assert.deepEqual(parseEnabledServices(undefined), []);
  assert.deepEqual(parseEnabledServices(''), []);
  assert.deepEqual(parseEnabledServices(' editorial , character-bot ,editorial'), ['editorial', 'character-bot']);
  assert.throws(() => parseEnabledServices('editorial,bibliotecario'), /sconosciuto/);
});

test('/health elenca solo i servizi abilitati E sani, e spiega gli altri', async () => {
  await withServer([service('editorial', true), service('character-bot', false)], async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { services: ['editorial'], down: [{ name: 'character-bot', reason: 'giù' }] });
  });
});

test('/health è 503 se nessun servizio è sano (o non ce n\'è nessuno)', async () => {
  await withServer([service('editorial', false)], async (base) => assert.equal((await fetch(`${base}/health`)).status, 503));
  await withServer([], async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { services: [], down: [] });
  });
});

test('un servizio che esplode nel health non rompe la risposta: risulta giù', async () => {
  const boom: AiService = { ...service('editorial', true), health: async () => { throw new Error('boom'); } };
  await withServer([boom, service('character-bot', true)], async (base) => {
    const body = (await (await fetch(`${base}/health`)).json()) as { services: string[]; down: { name: string }[] };
    assert.deepEqual(body.services, ['character-bot']);
    assert.deepEqual(body.down.map((d) => d.name), ['editorial']);
  });
});

test('rotte: smista al servizio giusto; servizio non attivo o azione sconosciuta = 404', async () => {
  const editorial = service('editorial', true, { generate: async (body) => ({ status: 200, body: { echo: body } }) });
  await withServer([editorial], async (base) => {
    const ok = await fetch(`${base}/v1/editorial/generate`, { method: 'POST', body: JSON.stringify({ a: 1 }) });
    assert.deepEqual(await ok.json(), { echo: { a: 1 } });
    assert.equal((await fetch(`${base}/v1/editorial/altro`, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await fetch(`${base}/v1/character-bot/events`, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await fetch(`${base}/v1/editorial/generate`)).status, 404, 'GET non è un\'azione');
  });
});

test('corpo non JSON = 400, troppo grande = 413', async () => {
  const editorial = service('editorial', true, { generate: async () => ({ status: 200, body: {} }) });
  await withServer([editorial], async (base) => {
    assert.equal((await fetch(`${base}/v1/editorial/generate`, { method: 'POST', body: '{non json' })).status, 400);
    assert.equal((await fetch(`${base}/v1/editorial/generate`, { method: 'POST', body: JSON.stringify({ x: 'a'.repeat(200_000) }) })).status, 413);
  });
});
