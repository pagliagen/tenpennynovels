import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventHandler, SEEN_EVENTS, type IntakeState } from '../intake';
import type { ReplyContext } from '../responder';
import { testBot } from './fixtures';

const LOC = 'a'.repeat(24);
const TOKEN = 'token-di-prova-abcdefghij';

const event = (over: Record<string, unknown> = {}) => ({
  eventId: 'e1', chatId: 'c1', characterId: 'player1', characterName: 'Tester', locationId: LOC, content: 'Buonasera', actionType: 'standard',
  visibility: 'public', isHidden: false, timestamp: new Date().toISOString(), ...over,
});
const body = (over: Record<string, unknown> = {}) => ({
  environment: 'local', locationId: LOC, event: event(), history: [{ characterId: 'player1', characterName: 'Tester', content: 'Buonasera' }],
  reply: { baseUrl: 'http://localhost:3001', token: TOKEN }, ...over,
});

function setup(over: Partial<IntakeState> = {}, makeBackendLog: { origin: string; token: string }[] = []) {
  const notified: (ReplyContext | undefined)[] = [];
  const bot = testBot({ characterId: 'bot1', locationId: LOC, environment: 'local' });
  const state: IntakeState = {
    allowedReplyOrigins: ['http://localhost:3001', 'https://api.tenpennynovels.com'],
    responders: new Map([[`local:${LOC}`, { bot, responder: { notify: (c) => { notified.push(c); } } }]]),
    botIds: new Map([['local', new Set(['bot1'])]]),
    ...over,
  };
  const handler = createEventHandler(() => state, (origin, token) => { makeBackendLog.push({ origin, token }); return { postMessage: async () => true }; });
  return { handler, notified, makeBackendLog };
}

test('un evento valido: 202, e il bot riceve la storia e un client con l\'indirizzo e il token dell\'evento', async () => {
  const { handler, notified, makeBackendLog } = setup();
  const r = await handler(body());
  assert.equal(r.status, 202);
  assert.deepEqual(r.body, { accepted: true });
  assert.equal(notified.length, 1);
  assert.deepEqual(notified[0]!.history.map((h) => h.content), ['Buonasera']);
  assert.deepEqual(makeBackendLog, [{ origin: 'http://localhost:3001', token: TOKEN }]);
});

test('indirizzo di risposta fuori lista: 400 e il bot non viene nemmeno svegliato (il token non va da nessuna parte)', async () => {
  const { handler, notified, makeBackendLog } = setup();
  for (const baseUrl of ['https://evil.example.com', 'http://api.tenpennynovels.com', 'https://api.tenpennynovels.com/x']) {
    const r = await handler(body({ reply: { baseUrl, token: TOKEN } }));
    assert.equal(r.status, 400, baseUrl);
    assert.equal((r.body as { code: string }).code, 'reply-not-allowed');
  }
  assert.equal(notified.length, 0);
  assert.equal(makeBackendLog.length, 0);
});

test('lista vuota (fail-closed): nessun evento accettato', async () => {
  const { handler } = setup({ allowedReplyOrigins: [] });
  assert.equal((await handler(body())).status, 400);
});

test('richiesta malformata 400; servizio non avviato 503', async () => {
  const { handler } = setup();
  assert.equal((await handler({ environment: 'NO!' })).status, 400);
  assert.equal((await handler(body({ history: 'no' }))).status, 400);
  assert.equal((await handler(null)).status, 400);
  const off = createEventHandler(() => null);
  assert.equal((await off(body())).status, 503);
});

test('nessun bot per (ambiente, location): accepted false; lo stesso id di location in un altro ambiente non è un bot di quello locale', async () => {
  const { handler, notified } = setup();
  assert.deepEqual((await handler(body({ environment: 'production' }))).body, { accepted: false, reason: 'no-bot' });
  assert.deepEqual((await handler(body({ locationId: 'f'.repeat(24), event: event({ locationId: 'f'.repeat(24) }) }))).body, { accepted: false, reason: 'no-bot' });
  assert.equal(notified.length, 0);
});

test('non tocca al bot: messaggi non pubblici o di un altro bot', async () => {
  const { handler, notified } = setup();
  assert.deepEqual((await handler(body({ event: event({ visibility: 'whisper' }) }))).body, { accepted: false, reason: 'not-triggered' });
  assert.deepEqual((await handler(body({ event: event({ isHidden: true }) }))).body, { accepted: false, reason: 'not-triggered' });
  assert.deepEqual((await handler(body({ event: event({ characterId: 'bot1' }) }))).body, { accepted: false, reason: 'not-triggered' });
  assert.equal(notified.length, 0);
});

test('lo stesso evento due volte: la seconda è scartata', async () => {
  const { handler, notified } = setup();
  assert.equal((await handler(body())).status, 202);
  assert.deepEqual((await handler(body())).body, { accepted: false, reason: 'duplicate' });
  assert.equal(notified.length, 1);
});

test('la memoria degli eventi visti ha un tetto (non cresce all\'infinito)', async () => {
  const { handler, notified } = setup();
  for (let i = 0; i < SEEN_EVENTS + 5; i++) await handler(body({ event: event({ eventId: `ev-${i}` }) }));
  assert.equal(notified.length, SEEN_EVENTS + 5);
  // il più vecchio è stato dimenticato: ora passerebbe di nuovo (limite accettato)
  assert.equal((await handler(body({ event: event({ eventId: 'ev-0' }) }))).status, 202);
  assert.deepEqual((await handler(body({ event: event({ eventId: `ev-${SEEN_EVENTS + 4}` }) }))).body, { accepted: false, reason: 'duplicate' });
});
