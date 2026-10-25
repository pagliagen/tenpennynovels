import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { botSlug, listBots, registerBot, RegisterError } from '../registry';
import { loadMapping } from '../config';

const LOC = 'a'.repeat(24);
const CHAR = 'b'.repeat(24);
const sheet = (over: Record<string, unknown> = {}) => ({
  name: 'Martha Quill', characterId: CHAR,
  persona: 'Sei una cameriera sbrigativa del locale e conosci tutti i clienti abituali del quartiere.',
  psyche: { ocean: { O: 40, C: 75, E: 55, A: 35, N: 50 }, enneagram: { type: 6, fear: 'restare sola', desire: 'un posto sicuro' }, pad: { p: -0.1, a: 0.2, d: 0.3 } },
  ...over,
});
const fresh = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'bots-'));
  return { root, paths: { botsDir: path.join(root, 'bots'), mappingFile: path.join(root, 'mapping.json') } };
};
const code = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return e instanceof RegisterError ? e.code : `altro:${String(e)}`; } };

test('lo slug è solo [a-z0-9-]: niente percorsi, punti o maiuscole', () => {
  assert.equal(botSlug('Martha Quill'), 'martha-quill');
  assert.equal(botSlug('Zoë  O\'Brien'), 'zoe-o-brien');
  assert.equal(botSlug('../../etc/passwd'), 'etc-passwd');
  assert.equal(botSlug('***'), '');
});

test('da zero (niente cartella, niente mapping) l\'elenco è vuoto e register crea tutto', () => {
  const { paths } = fresh();
  assert.deepEqual(listBots(paths), []);
  const r = registerBot(paths, { locationId: LOC, sheet: sheet() });
  assert.equal(r.file, 'martha-quill.json');
  assert.deepEqual(loadMapping(paths.mappingFile), [{ locationId: LOC, botId: CHAR }]);
  assert.deepEqual(listBots(paths), [{ name: 'Martha Quill', characterId: CHAR, locationId: LOC, file: 'martha-quill.json' }]);
  const saved = JSON.parse(readFileSync(path.join(paths.botsDir, 'martha-quill.json'), 'utf8'));
  assert.equal(saved.respondTo, 'all'); // i default sono scritti in chiaro
  assert.deepEqual(readdirSync(paths.botsDir), ['martha-quill.json']); // nessun file temporaneo
});

test('mai sovrascrivere: stessa scheda, stessa location, stesso personaggio', () => {
  const { paths } = fresh();
  registerBot(paths, { locationId: LOC, sheet: sheet() });
  assert.equal(code(() => registerBot(paths, { locationId: 'c'.repeat(24), sheet: sheet() })), 'file-exists');
  assert.equal(code(() => registerBot(paths, { locationId: LOC, sheet: sheet({ name: 'Ruth Vane', characterId: 'd'.repeat(24) }) })), 'location-taken');
  assert.equal(code(() => registerBot(paths, { locationId: 'c'.repeat(24), sheet: sheet({ name: 'Ruth Vane' }) })), 'character-taken');
  assert.equal(listBots(paths).length, 1);
  assert.equal(loadMapping(paths.mappingFile).length, 1);
});

test('input non valido: id, scheda, nome non trasformabile in file', () => {
  const { paths } = fresh();
  assert.equal(code(() => registerBot(paths, { locationId: 'nope', sheet: sheet() })), 'invalid');
  assert.equal(code(() => registerBot(paths, { locationId: LOC, sheet: sheet({ characterId: 'xyz' }) })), 'invalid');
  assert.equal(code(() => registerBot(paths, { locationId: LOC, sheet: sheet({ persona: 'corta' }) })), 'invalid');
  assert.equal(code(() => registerBot(paths, { locationId: LOC, sheet: sheet({ name: '***' }) })), 'invalid');
  assert.equal(existsSync(paths.botsDir) ? readdirSync(paths.botsDir).length : 0, 0);
});

test('un nome con percorso non esce dalla cartella dei bot', () => {
  const { paths, root } = fresh();
  registerBot(paths, { locationId: LOC, sheet: sheet({ name: '../../evil name' }) });
  assert.deepEqual(readdirSync(paths.botsDir), ['evil-name.json']);
  assert.equal(existsSync(path.join(root, 'evil-name.json')), false);
});

test('se il mapping non si può scrivere la scheda appena scritta viene tolta', () => {
  const { paths, root } = fresh();
  writeFileSync(path.join(root, 'mapping.json'), '[]');
  // il mapping è una cartella: la scrittura fallisce
  const bad = { botsDir: paths.botsDir, mappingFile: path.join(root, 'cartella', 'mapping.json') };
  assert.ok(String(code(() => registerBot(bad, { locationId: LOC, sheet: sheet() }))).startsWith('altro:'));
  assert.equal(existsSync(bad.botsDir) ? readdirSync(bad.botsDir).length : 0, 0);
});
