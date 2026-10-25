/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/botChat/__tests__/botChatPush.test.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';

// Va importato PRIMA di tutto il resto: `appConfig` legge le variabili quando viene caricato (gli import sono hoisted).
import './setupEnv';
import { SECRET } from './setupEnv';
import { botChatConfigStatus } from '../utils/botChatConfig';
import { BOT_TOKEN_TTL_SECONDS, signBotToken, verifyBotToken } from '../utils/botToken';
import { BotChatForwarder, isPublicStandard, parseEvent, type BotChatEvent, type EventPayload, type ForwarderDeps, type HistoryLine } from '../services/BotChatForwarder';

const FULL = { ENABLE_BOT_CHAT: 'true', BOT_SERVICE_SECRET: SECRET, BOT_REPLY_BASE_URL: 'https://api.example.com', AI_GATEWAY_URL: 'https://x.ngrok-free.dev', AI_GATEWAY_SECRET: 'segreto' };

describe('botChatConfigStatus: tutta la configurazione o niente', () => {
  it('spenta se la variabile non è «true» (valore esatto): nessun errore, nessun elenco', () => {
    for (const v of [undefined, '', 'false', '1', 'TRUE', 'yes']) {
      const s = botChatConfigStatus({ ...FULL, ENABLE_BOT_CHAT: v });
      assert.equal(s.enabled, false);
      assert.equal(s.complete, false);
      assert.deepEqual(s.missing, []);
    }
  });

  it('completa con tutto al suo posto, e riporta l\'indirizzo di risposta senza barra finale', () => {
    const s = botChatConfigStatus({ ...FULL, BOT_REPLY_BASE_URL: 'https://api.example.com/' });
    assert.equal(s.complete, true);
    assert.equal(s.replyBaseUrl, 'https://api.example.com');
  });

  it('un pezzo mancante o non valido alla volta: incompleta e dice quale', () => {
    const cases: [Record<string, string | undefined>, RegExp][] = [
      [{ BOT_SERVICE_SECRET: undefined }, /BOT_SERVICE_SECRET/],
      [{ BOT_SERVICE_SECRET: 'corto' }, /BOT_SERVICE_SECRET/],
      [{ BOT_REPLY_BASE_URL: undefined }, /BOT_REPLY_BASE_URL/],
      [{ BOT_REPLY_BASE_URL: 'non un url' }, /BOT_REPLY_BASE_URL/],
      [{ BOT_REPLY_BASE_URL: 'http://api.example.com' }, /BOT_REPLY_BASE_URL/], // http fuori da localhost: il token viaggerebbe in chiaro
      [{ AI_GATEWAY_URL: undefined }, /AI_GATEWAY_URL/],
      [{ AI_GATEWAY_SECRET: undefined }, /AI_GATEWAY_SECRET/],
    ];
    for (const [over, expected] of cases) {
      const s = botChatConfigStatus({ ...FULL, ...over });
      assert.equal(s.complete, false, JSON.stringify(over));
      assert.equal(s.replyBaseUrl, null);
      assert.match(s.missing.join(' '), expected);
    }
  });

  it('http è lecito solo su localhost', () => {
    assert.equal(botChatConfigStatus({ ...FULL, BOT_REPLY_BASE_URL: 'http://localhost:3001' }).complete, true);
    assert.equal(botChatConfigStatus({ ...FULL, BOT_REPLY_BASE_URL: 'http://127.0.0.1:3001' }).complete, true);
  });

  it('con più pezzi mancanti li elenca tutti, mai i valori', () => {
    const s = botChatConfigStatus({ ENABLE_BOT_CHAT: 'true', BOT_SERVICE_SECRET: 'segretissimo' });
    assert.equal(s.missing.length, 4);
    assert.doesNotMatch(s.missing.join(' '), /segretissimo/);
  });
});

describe('botToken', () => {
  const payload = { env: 'local', loc: '6a7cfaf246dd8e5807469462', bot: '6ad3ab82f8d470548346edc7', exp: 4102444800 };
  // Vettore fisso: lo stesso nel test di bot-service (copia di sviluppo dell'algoritmo).
  const GOLDEN = 'v1.eyJlbnYiOiJsb2NhbCIsImxvYyI6IjZhN2NmYWYyNDZkZDhlNTgwNzQ2OTQ2MiIsImJvdCI6IjZhZDNhYjgyZjhkNDcwNTQ4MzQ2ZWRjNyIsImV4cCI6NDEwMjQ0NDgwMH0.R1v4Dtxuw6EoF_8hSDSzrb5t-5a4LzDAtf1mym2YKi4';

  it('il vettore fisso torna uguale (compatibilità con bot-service)', () => {
    assert.equal(signBotToken(payload, SECRET), GOLDEN);
    assert.deepEqual(verifyBotToken(GOLDEN, SECRET, 1_000_000), payload);
  });

  it('firma sbagliata, segreto diverso, contenuto alterato, formato rotto: null', () => {
    const t = signBotToken(payload, SECRET);
    assert.equal(verifyBotToken(t, 'altro-segreto-altro-segreto-altro!', 1_000_000), null);
    const [v, , s] = t.split('.');
    const forged = `${v}.${Buffer.from(JSON.stringify({ ...payload, bot: 'altro' })).toString('base64url')}.${s}`;
    assert.equal(verifyBotToken(forged, SECRET, 1_000_000), null);
    for (const bad of ['', 'v1', 'v1.a', 'v2.a.b', `${t}x`, 'v1..', 'v1.@@@.###']) assert.equal(verifyBotToken(bad, SECRET, 1_000_000), null, bad);
  });

  it('scaduto = null; un secondo prima della scadenza vale', () => {
    const t = signBotToken({ ...payload, exp: 1000 }, SECRET);
    assert.equal(verifyBotToken(t, SECRET, 999)?.exp, 1000);
    assert.equal(verifyBotToken(t, SECRET, 1000), null);
  });

  it('contenuto di forma sbagliata (anche se la firma è giusta): null', () => {
    const body = `v1.${Buffer.from(JSON.stringify({ env: 1, loc: 'x' })).toString('base64url')}`;
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    assert.equal(verifyBotToken(`${body}.${sig}`, SECRET, 1), null);
  });
});

describe('botTokenAuth / botTokenScope', () => {
  const run = async (headers: Record<string, string>, body: unknown = {}, mw: 'auth' | 'scope' = 'auth', local?: unknown) => {
    const { botTokenAuth, botTokenScope, TOKEN_LOCAL } = await import('../utils/botTokenAuth');
    let status = 0;
    let nexted = false;
    const res = { locals: (local ? { [TOKEN_LOCAL]: local } : {}) as Record<string, unknown>, status(c: number) { status = c; return this; }, json() { return this; } };
    const req = { header: (n: string) => headers[n.toLowerCase()], body };
    (mw === 'auth' ? botTokenAuth : botTokenScope)(req as never, res as never, () => { nexted = true; });
    return { status, nexted, locals: res.locals };
  };
  const good = () => signBotToken({ env: 'local', loc: 'L1', bot: 'B1', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);

  it('senza token 401; con token valido passa e lo mette in locals', async () => {
    assert.equal((await run({})).status, 401);
    assert.equal((await run({ authorization: 'Basic abc' })).status, 401);
    const ok = await run({ authorization: `Bearer ${good()}` });
    assert.equal(ok.nexted, true);
    assert.equal((ok.locals as Record<string, { bot: string }>).botToken?.bot, 'B1');
  });

  it('token di un altro ambiente o scaduto: 401', async () => {
    const other = signBotToken({ env: 'production', loc: 'L1', bot: 'B1', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
    assert.equal((await run({ authorization: `Bearer ${other}` })).status, 401);
    const old = signBotToken({ env: 'local', loc: 'L1', bot: 'B1', exp: 10 }, SECRET);
    assert.equal((await run({ authorization: `Bearer ${old}` })).status, 401);
  });

  it('con la configurazione incompleta l\'API non esiste: 404 anche con un token giusto', async () => {
    const saved = process.env.ENABLE_BOT_CHAT;
    process.env.ENABLE_BOT_CHAT = 'false';
    try {
      assert.equal((await run({ authorization: `Bearer ${good()}` })).status, 404);
    } finally { process.env.ENABLE_BOT_CHAT = saved; }
  });

  it('lo scope: la risposta deve essere del bot e della location del token', async () => {
    const token = { env: 'local', loc: 'L1', bot: 'B1', exp: 9999999999 };
    assert.equal((await run({}, { characterId: 'B1', locationId: 'L1' }, 'scope', token)).nexted, true);
    assert.equal((await run({}, { characterId: 'B2', locationId: 'L1' }, 'scope', token)).status, 403);
    assert.equal((await run({}, { characterId: 'B1', locationId: 'L2' }, 'scope', token)).status, 403);
    assert.equal((await run({}, {}, 'scope', undefined)).status, 403);
  });
});

describe('BotChatForwarder', () => {
  const evt = (over: Partial<BotChatEvent> = {}): string => JSON.stringify({
    eventId: 'e1', chatId: 'c1', characterId: 'P1', characterName: 'Tester', locationId: 'L1', content: 'Buonasera', actionType: 'standard',
    visibility: 'public', isHidden: false, timestamp: new Date().toISOString(), ...over,
  });
  const history: HistoryLine[] = [{ characterId: 'P1', characterName: 'Tester', content: 'Buonasera' }];

  function setup(over: Partial<ForwarderDeps> = {}) {
    const sent: EventPayload[] = [];
    const counters = { available: 0, list: 0, history: 0 };
    const deps: ForwarderDeps = {
      environment: 'local',
      replyBaseUrl: 'http://localhost:3001',
      secret: SECRET,
      isAvailable: async () => { counters.available++; return true; },
      listBots: async () => { counters.list++; return [{ name: 'Barnaby Finch', characterId: 'B1', locationId: 'L1' }]; },
      loadHistory: async () => { counters.history++; return history.map((h) => ({ ...h })); },
      send: async (p) => { sent.push(p); },
      debounceMs: 20,
      ...over,
    };
    return { f: new BotChatForwarder(deps), sent, counters };
  }
  const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

  it('parseEvent e isPublicStandard: solo i messaggi che tutti i presenti vedono', () => {
    assert.equal(parseEvent('non json'), null);
    assert.equal(parseEvent(JSON.stringify({ eventId: 1 })), null);
    assert.equal(isPublicStandard(parseEvent(evt())!), true);
    assert.equal(isPublicStandard(parseEvent(evt({ visibility: 'whisper' }))!), false);
    assert.equal(isPublicStandard(parseEvent(evt({ isHidden: true }))!), false);
    assert.equal(isPublicStandard(parseEvent(evt({ actionType: 'master' }))!), false);
  });

  it('spinge l\'evento con storia, indirizzo e un token valido solo per quel bot in quella location', async () => {
    const { f, sent } = setup();
    f.handleRaw(evt());
    await settle();
    assert.equal(sent.length, 1);
    const p = sent[0]!;
    assert.equal(p.environment, 'local');
    assert.equal(p.locationId, 'L1');
    assert.equal(p.event.content, 'Buonasera');
    assert.deepEqual(p.history.map((h) => h.content), ['Buonasera']);
    assert.equal(p.reply.baseUrl, 'http://localhost:3001');
    const t = verifyBotToken(p.reply.token, SECRET)!;
    assert.deepEqual([t.env, t.loc, t.bot], ['local', 'L1', 'B1']);
    assert.ok(t.exp - Math.floor(Date.now() / 1000) <= BOT_TOKEN_TTL_SECONDS);
  });

  it('una raffica diventa una sola chiamata, con l\'ultimo messaggio', async () => {
    const { f, sent } = setup();
    f.handleRaw(evt({ eventId: 'e1', content: 'uno' }));
    f.handleRaw(evt({ eventId: 'e2', content: 'due' }));
    f.handleRaw(evt({ eventId: 'e3', content: 'tre' }));
    await settle();
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.event.content, 'tre');
  });

  it('niente chiamata: location senza bot, messaggio non pubblico, messaggio di un bot', async () => {
    const a = setup();
    a.f.handleRaw(evt({ locationId: 'ALTRA' }));
    a.f.handleRaw(evt({ visibility: 'whisper' }));
    a.f.handleRaw(evt({ characterId: 'B1' })); // il bot stesso
    await settle();
    assert.equal(a.sent.length, 0);
    assert.equal(a.counters.history, 0, 'nemmeno la query della storia');
  });

  it('servizio AI non disponibile: nessuna chiamata e nemmeno l\'elenco dei bot', async () => {
    const { f, sent, counters } = setup({ isAvailable: async () => false });
    f.handleRaw(evt());
    await settle();
    assert.equal(sent.length, 0);
    assert.equal(counters.list, 0);
  });

  it('l\'elenco dei bot è in cache; invalidate() lo rilegge; se non c\'è (Mac spento) nessun bot e un nuovo tentativo non a ogni messaggio', async () => {
    const { f, counters } = setup();
    f.handleRaw(evt({ eventId: 'a' })); await settle();
    f.handleRaw(evt({ eventId: 'b' })); await settle();
    assert.equal(counters.list, 1);
    f.invalidate();
    f.handleRaw(evt({ eventId: 'c' })); await settle();
    assert.equal(counters.list, 2);

    let calls = 0;
    const down = setup({ listBots: async () => { calls++; throw new Error('Mac spento'); } });
    down.f.handleRaw(evt()); await settle();
    down.f.handleRaw(evt()); await settle();
    assert.equal(down.sent.length, 0);
    assert.equal(calls, 1, 'non martella il tunnel a ogni messaggio');
  });

  it('un errore nell\'invio non lancia e non blocca i messaggi successivi', async () => {
    let n = 0;
    const sent: EventPayload[] = [];
    const { f } = setup({ send: async (p) => { n++; if (n === 1) throw new Error('tunnel giù'); sent.push(p); } });
    f.handleRaw(evt({ eventId: 'a' })); await settle();
    f.handleRaw(evt({ eventId: 'b' })); await settle();
    assert.equal(n, 2);
    assert.equal(sent.length, 1);
  });

  it('la descrizione della posizione dell\'evento si riattacca alla riga giusta della storia', async () => {
    const { f, sent } = setup();
    f.handleRaw(evt({ position: 'Ingresso', positionDescription: 'Dove si entra.' }));
    await settle();
    assert.equal(sent[0]!.history.at(-1)!.positionDescription, 'Dove si entra.');
  });
});
