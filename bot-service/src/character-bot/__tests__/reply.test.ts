import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedReplyOrigin } from '../reply';
import { parseOrigins } from '../config';
import { signDevToken } from '../scripts/devToken';
import { BackendClient } from '../backendClient';

const ALLOWED = ['https://api.tenpennynovels.com', 'http://localhost:3001'];

test('un token si invia solo a un origin della lista', () => {
  assert.equal(allowedReplyOrigin('https://api.tenpennynovels.com', ALLOWED), 'https://api.tenpennynovels.com');
  assert.equal(allowedReplyOrigin('https://api.tenpennynovels.com/', ALLOWED), 'https://api.tenpennynovels.com');
  assert.equal(allowedReplyOrigin('http://localhost:3001', ALLOWED), 'http://localhost:3001');
  assert.equal(allowedReplyOrigin('https://evil.example.com', ALLOWED), null);
  assert.equal(allowedReplyOrigin('https://api.tenpennynovels.com.evil.com', ALLOWED), null);
  assert.equal(allowedReplyOrigin('https://api.tenpennynovels.com@evil.com', ALLOWED), null);
});

test('lista vuota = fail-closed; http solo su loopback; niente percorsi né credenziali', () => {
  assert.equal(allowedReplyOrigin('https://api.tenpennynovels.com', []), null);
  assert.equal(allowedReplyOrigin('http://api.tenpennynovels.com', ['http://api.tenpennynovels.com']), null); // http fuori da loopback anche se in lista
  assert.equal(allowedReplyOrigin('https://api.tenpennynovels.com/bot-api', ALLOWED), null);
  assert.equal(allowedReplyOrigin('https://user:pw@api.tenpennynovels.com', ALLOWED), null);
  assert.equal(allowedReplyOrigin('non un url', ALLOWED), null);
  assert.equal(allowedReplyOrigin('ftp://localhost:3001', ALLOWED), null);
});

test('ALLOWED_REPLY_ORIGINS: elenco con virgole ridotto agli origin; un valore sbagliato è un errore all\'avvio', () => {
  assert.deepEqual(parseOrigins('https://api.tenpennynovels.com/, http://localhost:3001 ,'), ['https://api.tenpennynovels.com', 'http://localhost:3001']);
  assert.deepEqual(parseOrigins(''), []);
  assert.throws(() => parseOrigins('api.tenpennynovels.com'), /non è un indirizzo valido/);
});

test('il vettore fisso del gioco torna uguale (compatibilità con unified-backend)', () => {
  const token = signDevToken({ env: 'local', loc: '6a7cfaf246dd8e5807469462', bot: '6ad3ab82f8d470548346edc7', exp: 4102444800 }, '0123456789abcdef0123456789abcdef');
  assert.equal(token, 'v1.eyJlbnYiOiJsb2NhbCIsImxvYyI6IjZhN2NmYWYyNDZkZDhlNTgwNzQ2OTQ2MiIsImJvdCI6IjZhZDNhYjgyZjhkNDcwNTQ4MzQ2ZWRjNyIsImV4cCI6NDEwMjQ0NDgwMH0.R1v4Dtxuw6EoF_8hSDSzrb5t-5a4LzDAtf1mym2YKi4');
});

test('il client risponde all\'indirizzo e con il token dell\'evento: /bot-api e Authorization Bearer, mai il vecchio segreto', async () => {
  const calls: { url: string; headers: Record<string, string>; body: string | undefined }[] = [];
  const realFetch = global.fetch;
  global.fetch = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body: init?.body as string | undefined });
    return new Response(JSON.stringify({ data: { description: 'Sereno.', words: ['sole'] } }), { status: 200 });
  }) as typeof fetch;
  try {
    const client = new BackendClient('https://api.tenpennynovels.com', 'TOKEN-DELL-EVENTO-1234567890');
    assert.equal(await client.postMessage({ characterId: 'b'.repeat(24), locationId: 'a'.repeat(24), content: 'Buonasera.' }), true);
    await client.getAppearance('p'.repeat(24));
    await client.getEnvironment();
    await client.getLocationTags();
    await client.getKnowledge({ tags: [], fromLocationId: 'a'.repeat(24), knownDistricts: [] });
  } finally { global.fetch = realFetch; }

  assert.deepEqual(calls.map((c) => new URL(c.url).pathname), [
    '/bot-api/messages', `/bot-api/characters/${'p'.repeat(24)}`, '/bot-api/environment', '/bot-api/knowledge/tags', '/bot-api/knowledge',
  ]);
  for (const c of calls) {
    assert.equal(c.headers.Authorization, 'Bearer TOKEN-DELL-EVENTO-1234567890');
    assert.equal(c.headers['X-Bot-Service-Secret'], undefined);
    assert.equal(new URL(c.url).origin, 'https://api.tenpennynovels.com');
  }
});

test('aspetto, meteo e tag in cache non si mescolano fra indirizzi diversi', async () => {
  let n = 0;
  const realFetch = global.fetch;
  global.fetch = (async () => { n++; return new Response(JSON.stringify({ data: { description: `Meteo ${n}`, words: ['x'] } }), { status: 200 }); }) as typeof fetch;
  try {
    const a1 = await new BackendClient('https://a.example.com', 't1'.repeat(10)).getEnvironment();
    const a2 = await new BackendClient('https://a.example.com', 't2'.repeat(10)).getEnvironment(); // stesso indirizzo, altro token: cache
    const b = await new BackendClient('https://b.example.com', 't3'.repeat(10)).getEnvironment(); // altro indirizzo: nuova chiamata
    assert.equal(a1?.description, 'Meteo 1');
    assert.equal(a2?.description, 'Meteo 1');
    assert.equal(b?.description, 'Meteo 2');
  } finally { global.fetch = realFetch; }
});
