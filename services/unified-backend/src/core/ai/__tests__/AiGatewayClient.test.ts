/**
 *   cd services/unified-backend
 *   npx tsx --test src/core/ai/__tests__/AiGatewayClient.test.ts
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { AiGatewayClient, AiGatewayError, DEFAULT_AI_GATEWAY_OPTIONS } from '../AiGatewayClient';
import { isEnvFlagActive } from '../../features/envFlag';

const SECRET = 's'.repeat(40);

interface Fake {
  url: string;
  hits: { path: string; headers: IncomingMessage['headers'] }[];
  setHandler(h: (req: IncomingMessage, res: ServerResponse) => void): void;
  close(): Promise<void>;
}

async function fakeGateway(): Promise<Fake> {
  const hits: Fake['hits'] = [];
  let handler: (req: IncomingMessage, res: ServerResponse) => void = (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ services: ['editorial'], down: [] }));
  };
  const server: Server = createServer((req, res) => { hits.push({ path: req.url ?? '', headers: req.headers }); handler(req, res); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    hits,
    setHandler: (h) => { handler = h; },
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}

const json = (status: number, body: unknown) => (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

function client(fake: Fake | null, over: Partial<ConstructorParameters<typeof AiGatewayClient>[0]> = {}) {
  let t = 1_000_000;
  const c = new AiGatewayClient({ ...DEFAULT_AI_GATEWAY_OPTIONS, url: fake?.url, secret: fake ? SECRET : undefined, now: () => t, ...over });
  return { c, advance: (ms: number) => { t += ms; } };
}

describe('isAvailable', () => {
  it('attivo solo se il gateway risponde 200 con il servizio nell\'elenco, e manda il segreto', async () => {
    const fake = await fakeGateway();
    try {
      const { c } = client(fake);
      assert.equal(await c.isAvailable('editorial'), true);
      assert.equal(await c.isAvailable('character-bot'), false, 'servizio non nell\'elenco');
      assert.equal(fake.hits[0]!.path, '/health');
      assert.equal(fake.hits[0]!.headers['x-ai-gateway-secret'], SECRET);
      assert.equal(fake.hits[0]!.headers['ngrok-skip-browser-warning'], '1');
    } finally { await fake.close(); }
  });

  it('non configurato = non attivo, senza rete', async () => {
    const { c } = client(null);
    assert.equal(c.isConfigured(), false);
    assert.equal(await c.isAvailable('editorial'), false);
  });

  it('risposte che NON contano: 404 HTML (tunnel ngrok spento), 200 non JSON, forma sbagliata, 401, 503', async () => {
    const fake = await fakeGateway();
    try {
      const cases: [string, (req: IncomingMessage, res: ServerResponse) => void][] = [
        ['404 html', (_r, res) => { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<html>ERR_NGROK_3200</html>'); }],
        ['200 html', (_r, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>pagina di avviso</html>'); }],
        ['forma sbagliata', json(200, { ok: true })],
        ['servizi non stringhe', json(200, { services: [1] })],
        ['401', json(401, { error: 'Non autorizzato' })],
        ['503', json(503, { services: [], down: [{ name: 'editorial', reason: 'Ollama non raggiungibile' }] })],
      ];
      for (const [label, handler] of cases) {
        fake.setHandler(handler);
        const { c } = client(fake);
        assert.equal(await c.isAvailable('editorial'), false, label);
      }
    } finally { await fake.close(); }
  });

  it('timeout = non attivo', async () => {
    const fake = await fakeGateway();
    try {
      fake.setHandler(() => { /* non risponde */ });
      const { c } = client(fake, { probeTimeoutMs: 200 });
      assert.equal(await c.isAvailable('editorial'), false);
    } finally { await fake.close(); }
  });

  it('cache: una sonda sola entro il TTL, e dieci richieste insieme fanno una chiamata', async () => {
    const fake = await fakeGateway();
    try {
      const { c, advance } = client(fake);
      await Promise.all(Array.from({ length: 10 }, () => c.isAvailable('editorial')));
      assert.equal(fake.hits.length, 1, 'una sola sonda in volo');
      advance(59_000);
      await c.isAvailable('editorial');
      assert.equal(fake.hits.length, 1, 'ancora in cache (ok: 60 s)');
      advance(2_000);
      await c.isAvailable('editorial');
      assert.equal(fake.hits.length, 2, 'scaduta: ricontrolla');
    } finally { await fake.close(); }
  });

  it('dopo un fallo ricontrolla presto (10 s), e si riprende appena il gateway torna', async () => {
    const fake = await fakeGateway();
    try {
      fake.setHandler(json(503, { services: [], down: [] }));
      const { c, advance } = client(fake);
      assert.equal(await c.isAvailable('editorial'), false);
      advance(5_000);
      assert.equal(await c.isAvailable('editorial'), false);
      assert.equal(fake.hits.length, 1, 'fallo ancora in cache');
      fake.setHandler(json(200, { services: ['editorial'], down: [] }));
      advance(6_000);
      assert.equal(await c.isAvailable('editorial'), true);
      assert.equal(fake.hits.length, 2);
    } finally { await fake.close(); }
  });
});

describe('generate', () => {
  it('restituisce il risultato e manda il corpo al servizio giusto', async () => {
    const fake = await fakeGateway();
    try {
      fake.setHandler(json(200, { text: 'Una bozza.', ms: 12 }));
      const { c } = client(fake);
      const res = await c.generate('editorial', { system: 's', user: 'u' });
      assert.deepEqual(res, { text: 'Una bozza.', ms: 12 });
      assert.equal(fake.hits[0]!.path, '/v1/editorial/generate');
      assert.equal(fake.hits[0]!.headers['x-ai-gateway-secret'], SECRET);
    } finally { await fake.close(); }
  });

  it('gli errori sono in italiano e senza dettagli tecnici', async () => {
    const fake = await fakeGateway();
    try {
      const expectError = async (handler: Parameters<Fake['setHandler']>[0], status: number, message: RegExp) => {
        fake.setHandler(handler);
        const { c } = client(fake);
        await assert.rejects(() => c.generate('editorial', { system: 's', user: 'u' }), (e: unknown) => {
          assert.ok(e instanceof AiGatewayError);
          assert.equal(e.status, status);
          assert.match(e.userMessage, message);
          assert.doesNotMatch(e.userMessage, /ECONN|127\.0\.0\.1|Ollama|HTTP/);
          return true;
        });
      };
      await expectError(json(429, { error: 'Troppe richieste' }), 429, /occupato/);
      await expectError(json(502, { error: 'Modello non disponibile' }), 503, /non è disponibile/);
      await expectError(json(401, { error: 'Non autorizzato' }), 503, /non è disponibile/);
      await expectError((_r, res) => { res.writeHead(200); res.end('non json'); }, 502, /non valida/);
    } finally { await fake.close(); }
  });

  it('non configurato: 503; irraggiungibile: 503; lento: 504', async () => {
    await assert.rejects(() => client(null).c.generate('editorial', { system: 's', user: 'u' }), (e: unknown) => e instanceof AiGatewayError && e.status === 503);
    const unreachable = client({ url: 'http://127.0.0.1:1', hits: [], setHandler: () => {}, close: async () => {} });
    await assert.rejects(() => unreachable.c.generate('editorial', { system: 's', user: 'u' }), (e: unknown) => e instanceof AiGatewayError && e.status === 503);
    const fake = await fakeGateway();
    try {
      fake.setHandler(() => { /* non risponde */ });
      const { c } = client(fake, { generateTimeoutMs: 200 });
      await assert.rejects(() => c.generate('editorial', { system: 's', user: 'u' }), (e: unknown) => e instanceof AiGatewayError && e.status === 504);
    } finally { await fake.close(); }
  });
});

describe('call (azioni di un servizio)', () => {
  it('POST /v1/<servizio>/<azione> con il segreto e restituisce il JSON', async () => {
    const fake = await fakeGateway();
    try {
      fake.setHandler(json(200, { bots: [] }));
      const { c } = client(fake);
      assert.deepEqual(await c.call('character-bot', 'list', {}), { bots: [] });
      assert.equal(fake.hits[0]!.path, '/v1/character-bot/list');
      assert.equal(fake.hits[0]!.headers['x-ai-gateway-secret'], SECRET);
    } finally { await fake.close(); }
  });

  it('400/409/429 del servizio passano con messaggio e codice; il resto è generico', async () => {
    const fake = await fakeGateway();
    try {
      const { c } = client(fake);
      fake.setHandler(json(409, { error: 'Questa location ha già un bot', code: 'location-taken' }));
      await assert.rejects(() => c.call('character-bot', 'register', {}), (e: unknown) => e instanceof AiGatewayError && e.status === 409 && e.userMessage === 'Questa location ha già un bot' && e.code === 'location-taken');
      fake.setHandler(json(500, { error: 'ENOENT /Users/qualcuno/bots/x.json' }));
      await assert.rejects(() => c.call('character-bot', 'register', {}), (e: unknown) => e instanceof AiGatewayError && e.status === 503 && !/ENOENT/.test(e.userMessage));
      fake.setHandler(json(401, { error: 'Non autorizzato' }));
      await assert.rejects(() => c.call('character-bot', 'list', {}), (e: unknown) => e instanceof AiGatewayError && e.status === 503);
    } finally { await fake.close(); }
  });

  it('non configurato: 503; lento: 504 con il timeout della singola chiamata', async () => {
    await assert.rejects(() => client(null).c.call('character-bot', 'list', {}), (e: unknown) => e instanceof AiGatewayError && e.status === 503);
    const fake = await fakeGateway();
    try {
      fake.setHandler(() => { /* non risponde */ });
      const { c } = client(fake);
      await assert.rejects(() => c.call('character-bot', 'design', {}, { timeoutMs: 200 }), (e: unknown) => e instanceof AiGatewayError && e.status === 504);
    } finally { await fake.close(); }
  });
});

describe('isEnvFlagActive (semantica del flag)', () => {
  const spec = { envVar: 'ENABLE_IA_EDITORIAL', requiresAiService: 'editorial' };

  it('variabile spenta: spenta e il gateway non viene nemmeno interrogato', async () => {
    let asked = false;
    const probe = async () => { asked = true; return true; };
    for (const value of [undefined, 'false', '1', 'TRUE']) {
      assert.equal(await isEnvFlagActive(spec, probe, { ENABLE_IA_EDITORIAL: value }), false);
    }
    assert.equal(asked, false);
  });

  it('variabile accesa: conta il gateway', async () => {
    const env = { ENABLE_IA_EDITORIAL: 'true' };
    assert.equal(await isEnvFlagActive(spec, async (s) => s === 'editorial', env), true);
    assert.equal(await isEnvFlagActive(spec, async () => false, env), false);
  });

  it('senza servizio AI dietro basta la variabile', async () => {
    assert.equal(await isEnvFlagActive({ envVar: 'X' }, async () => false, { X: 'true' }), true);
  });
});
