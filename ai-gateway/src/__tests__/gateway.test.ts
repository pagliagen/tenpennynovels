import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isAuthorized, SECRET_HEADER } from '../auth';
import type { GatewayConfig } from '../config';
import { RateLimiter } from '../limits';
import { resolveRoute } from '../registry';
import { createGatewayHandler } from '../server';

const SECRET = 'a'.repeat(40);

type Handler = RequestListener;

async function listen(handler: Handler): Promise<{ server: Server; url: string }> {
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const close = (server: Server): Promise<void> => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); });

/** Un bot-service finto: health e un'azione di eco. */
function fakeBotService(over: { health?: () => { status: number; body: string } } = {}): Handler {
  return (req, res) => {
    if (req.url === '/health') {
      const h = over.health?.() ?? { status: 200, body: JSON.stringify({ services: ['editorial'], down: [] }) };
      res.writeHead(h.status, { 'Content-Type': 'application/json' });
      return void res.end(h.body);
    }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: req.url, got: Buffer.concat(chunks).toString() }));
    });
  };
}

async function withGateway<T>(upstream: Handler | null, over: Partial<GatewayConfig>, fn: (base: string) => Promise<T>): Promise<T> {
  const up = upstream ? await listen(upstream) : null;
  const config: GatewayConfig = {
    port: 0, host: '127.0.0.1', secret: SECRET, botServiceUrl: up?.url ?? 'http://127.0.0.1:1', rateLimitPerMinute: 100, maxBodyBytes: 1024, upstreamTimeoutMs: 2000, ...over,
  };
  const gw = await listen(createGatewayHandler(config));
  try {
    return await fn(gw.url);
  } finally {
    await close(gw.server);
    if (up) await close(up.server);
  }
}

const authed = { [SECRET_HEADER]: SECRET };
const post = (base: string, path: string, body: unknown, headers: Record<string, string> = authed) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('segreto: solo il valore esatto passa; assente, vuoto, sbagliato o di altra lunghezza no', () => {
  assert.equal(isAuthorized(SECRET, SECRET), true);
  for (const bad of [undefined, '', 'x', SECRET + 'a', SECRET.slice(1), ['a'], 'b'.repeat(40)]) assert.equal(isAuthorized(bad as never, SECRET), false);
});

test('registro: solo POST /v1/<servizio>/<azione> con servizio noto', () => {
  assert.deepEqual(resolveRoute('/v1/editorial/generate'), { service: 'editorial', action: 'generate' });
  assert.deepEqual(resolveRoute('/v1/character-bot/events'), { service: 'character-bot', action: 'events' });
  for (const p of ['/v1/ollama/generate', '/v1/editorial', '/v1/editorial/a/b', '/api/tags', '/v1/../health', '/']) assert.equal(resolveRoute(p), null, p);
});

test('rate limit: finestra mobile di 60 s', () => {
  let t = 0;
  const limiter = new RateLimiter(2, () => t);
  assert.deepEqual([limiter.allow(), limiter.allow(), limiter.allow()], [true, true, false]);
  t = 61_000;
  assert.equal(limiter.allow(), true);
});

test('senza segreto è 401 identico per /health, azioni e percorsi inesistenti: non si scopre nulla', async () => {
  await withGateway(fakeBotService(), {}, async (base) => {
    const responses = await Promise.all([
      fetch(`${base}/health`), post(base, '/v1/editorial/generate', {}, {}), fetch(`${base}/qualcosa`), fetch(`${base}/health`, { headers: { [SECRET_HEADER]: 'sbagliato' } }),
    ]);
    for (const r of responses) {
      assert.equal(r.status, 401);
      assert.deepEqual(await r.json(), { error: 'Non autorizzato' });
    }
  });
});

test('/health con segreto: i servizi attivi dal bot-service, e niente di più', async () => {
  const noisy = () => ({ status: 200, body: JSON.stringify({ services: ['editorial', 'character-bot'], down: [{ name: 'x', reason: 'r' }], segreti: 'NO', prompt: 'NO' }) });
  await withGateway(fakeBotService({ health: noisy }), {}, async (base) => {
    const res = await fetch(`${base}/health`, { headers: authed });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { services: ['editorial', 'character-bot'], down: [{ name: 'x', reason: 'r' }] });
  });
});

test('/health: nessun servizio sano, risposta sbagliata o bot-service giù = 503 con services vuoto', async () => {
  const cases: [string, (() => { status: number; body: string }) | null][] = [
    ['nessun sano', () => ({ status: 503, body: JSON.stringify({ services: [], down: [{ name: 'editorial', reason: 'Ollama non raggiungibile' }] }) })],
    ['non JSON', () => ({ status: 200, body: '<html>pagina ngrok</html>' })],
    ['forma sbagliata', () => ({ status: 200, body: JSON.stringify({ ok: true }) })],
    ['servizi non stringhe', () => ({ status: 200, body: JSON.stringify({ services: [1, 2] }) })],
  ];
  for (const [label, health] of cases) {
    await withGateway(fakeBotService({ health: health! }), {}, async (base) => {
      const res = await fetch(`${base}/health`, { headers: authed });
      assert.equal(res.status, 503, label);
      assert.deepEqual(((await res.json()) as { services: string[] }).services, [], label);
    });
  }
  await withGateway(null, {}, async (base) => {
    const res = await fetch(`${base}/health`, { headers: authed });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { services: [], down: [{ name: 'bot-service', reason: 'non raggiungibile' }] });
  });
});

test('inoltra a bot-service il corpo e restituisce lo stato dell\'upstream', async () => {
  await withGateway(fakeBotService(), {}, async (base) => {
    const res = await post(base, '/v1/editorial/generate', { system: 's', user: 'u' });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { path: '/v1/editorial/generate', got: '{"system":"s","user":"u"}' });
  });
});

test('non è un proxy aperto: servizi e percorsi fuori registro, o metodi diversi, sono 404', async () => {
  await withGateway(fakeBotService(), {}, async (base) => {
    assert.equal((await post(base, '/v1/ollama/generate', {})).status, 404);
    assert.equal((await post(base, '/api/generate', {})).status, 404);
    assert.equal((await fetch(`${base}/v1/editorial/generate`, { headers: authed })).status, 404, 'GET non è un\'azione');
    assert.equal((await fetch(`${base}/v1/editorial/generate`, { method: 'DELETE', headers: authed })).status, 404);
  });
});

test('corpo oltre il limite = 413 senza arrivare all\'upstream', async () => {
  let reached = false;
  await withGateway((req, res) => { reached = true; fakeBotService()(req, res); }, {}, async (base) => {
    const res = await post(base, '/v1/editorial/generate', { x: 'a'.repeat(5000) });
    assert.equal(res.status, 413);
  });
  assert.equal(reached, false);
});

test('rate limit: oltre il tetto 429; le richieste senza segreto non consumano la quota', async () => {
  await withGateway(fakeBotService(), { rateLimitPerMinute: 2 }, async (base) => {
    for (let i = 0; i < 5; i++) assert.equal((await fetch(`${base}/health`)).status, 401);
    assert.equal((await fetch(`${base}/health`, { headers: authed })).status, 200);
    assert.equal((await fetch(`${base}/health`, { headers: authed })).status, 200);
    assert.equal((await fetch(`${base}/health`, { headers: authed })).status, 429);
  });
});

test('upstream lento = 504, upstream irraggiungibile = 502, mai dettagli tecnici', async () => {
  await withGateway((_req, _res) => { /* non risponde mai */ }, { upstreamTimeoutMs: 300 }, async (base) => {
    const res = await post(base, '/v1/editorial/generate', {});
    assert.equal(res.status, 504);
  });
  await withGateway(null, {}, async (base) => {
    const res = await post(base, '/v1/editorial/generate', {});
    assert.equal(res.status, 502);
    assert.doesNotMatch(JSON.stringify(await res.json()), /ECONNREFUSED|127\.0\.0\.1/);
  });
});
