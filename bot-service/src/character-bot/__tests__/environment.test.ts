import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { botDefSchema, loadMapping, resolveBots } from '../config';
import { listBots, registerBot, RegisterError } from '../registry';
import { createAdminRoutes } from '../admin';

const LOC = 'a'.repeat(24);
const LOC2 = 'e'.repeat(24);
const sheet = (over: Record<string, unknown> = {}) => ({
  name: 'Martha Quill', characterId: 'b'.repeat(24),
  persona: 'Sei una cameriera sbrigativa del locale e conosci tutti i clienti abituali del quartiere.',
  psyche: { ocean: { O: 40, C: 75, E: 55, A: 35, N: 50 }, enneagram: { type: 6, fear: 'restare sola', desire: 'un posto sicuro' }, pad: { p: -0.1, a: 0.2, d: 0.3 } },
  ...over,
});
const fresh = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'env-'));
  return { root, paths: { botsDir: path.join(root, 'bots'), mappingFile: path.join(root, 'mapping.json') } };
};
const code = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return e instanceof RegisterError ? e.code : `altro:${String(e)}`; } };

test('le schede e le righe senza etichetta (scritte prima) sono `local`', () => {
  assert.equal(botDefSchema.parse(sheet()).environment, 'local');
});

test('resolveBots carica solo l\'ambiente del servizio e ignora il resto, anche se manca la scheda', () => {
  const defs = [botDefSchema.parse(sheet({ characterId: 'l1', name: 'Locale' })), botDefSchema.parse(sheet({ characterId: 'p1', name: 'Live', environment: 'production' }))];
  const mapping = [
    { locationId: LOC, botId: 'l1', environment: 'local' },
    { locationId: LOC, botId: 'p1', environment: 'production' },   // stessa location, altro ambiente: lecito
    { locationId: LOC2, botId: 'senza-scheda', environment: 'production' }, // di un altro ambiente: non è un problema di questo
  ];
  assert.deepEqual(resolveBots(defs, mapping, 'local').map((b) => b.name), ['Locale']);
  assert.deepEqual(resolveBots(defs, mapping.slice(0, 2), 'production').map((b) => b.name), ['Live']);
  assert.throws(() => resolveBots(defs, mapping, 'production'), /senza-scheda/);
});

test('due bot sulla stessa location nello stesso ambiente restano un errore', () => {
  const defs = [botDefSchema.parse(sheet({ characterId: 'a1', name: 'Uno' })), botDefSchema.parse(sheet({ characterId: 'a2', name: 'Due' }))];
  assert.throws(() => resolveBots(defs, [{ locationId: LOC, botId: 'a1', environment: 'local' }, { locationId: LOC, botId: 'a2', environment: 'local' }], 'local'), /stessa location/);
});

test('register: stessa location e stesso nome in due ambienti convivono, con file diversi', () => {
  const { paths } = fresh();
  assert.equal(registerBot(paths, { locationId: LOC, sheet: sheet() }).file, 'martha-quill.json');
  const live = registerBot(paths, { locationId: LOC, environment: 'production', sheet: sheet({ characterId: 'c'.repeat(24) }) });
  assert.equal(live.file, 'martha-quill-production.json');
  assert.deepEqual(readdirSync(paths.botsDir).sort(), ['martha-quill-production.json', 'martha-quill.json']);
  assert.equal(JSON.parse(readFileSync(path.join(paths.botsDir, live.file), 'utf8')).environment, 'production');
  assert.deepEqual(loadMapping(paths.mappingFile).map((m) => [m.locationId, m.environment]), [[LOC, 'local'], [LOC, 'production']]);
  assert.deepEqual(listBots(paths).map((b) => [b.environment, b.locationId]).sort(), [['local', LOC], ['production', LOC]]);
});

test('register: la location è occupata solo nello stesso ambiente; lo stesso personaggio mai due volte', () => {
  const { paths } = fresh();
  registerBot(paths, { locationId: LOC, environment: 'production', sheet: sheet() });
  assert.equal(code(() => registerBot(paths, { locationId: LOC, environment: 'production', sheet: sheet({ name: 'Ruth Vane', characterId: 'd'.repeat(24) }) })), 'location-taken');
  assert.equal(code(() => registerBot(paths, { locationId: LOC, sheet: sheet({ name: 'Ruth Vane', characterId: 'd'.repeat(24) }) })), null);
  assert.equal(code(() => registerBot(paths, { locationId: LOC2, environment: 'local', sheet: sheet({ name: 'Altra' }) })), 'character-taken');
  assert.equal(code(() => registerBot(paths, { locationId: LOC2, environment: 'Production!', sheet: sheet({ name: 'Altra', characterId: 'f'.repeat(24) }) })), 'invalid');
});

test('list con un ambiente: solo i suoi bot, gli altri si contano; senza ambiente: tutti', async () => {
  const { paths } = fresh();
  registerBot(paths, { locationId: LOC, sheet: sheet() });
  registerBot(paths, { locationId: LOC, environment: 'production', sheet: sheet({ name: 'Live Bot', characterId: 'c'.repeat(24) }) });
  const routes = createAdminRoutes({ paths, llm: () => ({ generate: async () => '', generateJson: async () => ({}) }), reload: async () => undefined, loaded: () => new Set(['b'.repeat(24)]) });
  const local = (await routes.list({ environment: 'local' })).body as { bots: { name: string; active: boolean }[]; hiddenOtherEnvironments: number };
  assert.deepEqual(local.bots.map((b) => [b.name, b.active]), [['Martha Quill', true]]);
  assert.equal(local.hiddenOtherEnvironments, 1);
  const live = (await routes.list({ environment: 'production' })).body as { bots: { name: string; active: boolean }[]; hiddenOtherEnvironments: number };
  assert.deepEqual(live.bots.map((b) => [b.name, b.active]), [['Live Bot', false]]);
  assert.equal(((await routes.list({})).body as { bots: unknown[] }).bots.length, 2);
  assert.equal((await routes.list({ environment: 'NO!' })).status, 400);
});

test('register via azione passa l\'ambiente', async () => {
  const { paths } = fresh();
  const routes = createAdminRoutes({ paths, llm: () => ({ generate: async () => '', generateJson: async () => ({}) }), reload: async () => undefined, loaded: () => new Set() });
  const r = await routes.register({ locationId: LOC, environment: 'production', sheet: sheet() });
  assert.equal(r.status, 200);
  assert.equal((r.body as { file: string }).file, 'martha-quill-production.json');
});
