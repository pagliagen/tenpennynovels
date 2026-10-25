/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/botAdmin/__tests__/botAdmin.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiGatewayError } from '../../../core/ai/AiGatewayClient';
import { BotAdminError, createBot, listBots, prepareDesign, runDesign, type BotAdminDeps, type LocationInfo } from '../services/BotAdminService';
import { botSheet, draftSchema } from '../utils/draft';

const LOC = 'a'.repeat(24);
const location: LocationInfo = { _id: LOC, name: 'The Rusty Anchor', quartiere: 'Wapping', district: 'East End', description: 'Una taverna di marinai.', tagLabels: ['Taverna / pub'], positionNames: ['Bancone'], hasChat: true };

const draft = () => ({
  character: {
    name: 'Martha Quill', firstName: 'Martha', surname: 'Quill', gender: 'female', age: 41, apparentAge: 46,
    height: '1.62m', eyeColor: 'castani', hairColor: 'grigi', visibleMarks: '',
    physicalDescription: 'È una donna magra dal viso segnato, sempre con un grembiule stretto in vita.',
    publicDescription: 'Una cameriera dall\'aria stanca e dagli occhi attenti.',
  },
  persona: 'Sei una cameriera sbrigativa del locale, vedova da molti anni. Servi i tavoli senza fermarti. Sai tutto del quartiere. Con gli sconosciuti sei diffidente. Racconti i pettegolezzi solo a chi ti rispetta. Parli a frasi corte.',
  psyche: { ocean: { O: 40, C: 75, E: 55, A: 35, N: 50 }, enneagram: { type: 6, fear: 'restare sola', desire: 'un posto sicuro' }, pad: { p: -0.1, a: 0.2, d: 0.3 } },
});

function setup(over: Partial<BotAdminDeps> = {}, bots: { name: string; characterId: string; locationId: string | null; file: string; active: boolean }[] = []) {
  const calls: { action: string; body: unknown; timeoutMs?: number | undefined }[] = [];
  const created: string[] = [];
  const deleted: string[] = [];
  const deps: BotAdminDeps = {
    call: async (action, body, timeoutMs) => {
      calls.push({ action, body, timeoutMs });
      if (action === 'list') return { bots };
      if (action === 'register') return { file: 'martha-quill.json', characterId: 'c'.repeat(24), reloaded: true };
      return { draft: draft(), checks: [{ code: 'schema', ok: true }], attempts: 1, ms: 15000 };
    },
    loadLocation: async (id) => (id === LOC ? location : null),
    locationNames: async () => new Map([[LOC, 'The Rusty Anchor']]),
    characterStatuses: async () => new Map([['b'.repeat(24), 'approved']]),
    systemUserExists: async () => true,
    nameInUse: async () => false,
    createCharacter: async () => { created.push('c'.repeat(24)); return 'c'.repeat(24); },
    deleteCharacter: async (id) => { deleted.push(id); },
    ...over,
  };
  return { deps, calls, created, deleted };
}

const rejectsWith = async (fn: () => Promise<unknown>, status: number, code?: string) =>
  assert.rejects(fn, (e: unknown) => e instanceof BotAdminError && e.status === status && (code === undefined || e.code === code));

describe('listBots', () => {
  it('arricchisce l\'elenco del servizio con il nome della location e lo stato del personaggio', async () => {
    const { deps } = setup({}, [{ name: 'Barnaby Finch', characterId: 'b'.repeat(24), locationId: LOC, file: 'barnaby-finch.json', active: true }]);
    const [bot] = await listBots(deps);
    assert.equal(bot!.locationName, 'The Rusty Anchor');
    assert.equal(bot!.playerStatus, 'approved');
    assert.equal(bot!.active, true);
  });

  it('risposta del servizio senza elenco = errore 502', async () => {
    const { deps } = setup({ call: async () => ({}) });
    await rejectsWith(() => listBots(deps), 502, 'BAD_RESPONSE');
  });
});

describe('prepareDesign (controlli prima del modello)', () => {
  it('descrizione troppo corta: 422 e il servizio non viene chiamato', async () => {
    const { deps, calls } = setup();
    await rejectsWith(() => prepareDesign(deps, { locationId: LOC, description: 'una cameriera' }), 422, 'INSUFFICIENT_INPUT');
    assert.equal(calls.length, 0);
  });

  it('location inesistente 404; quartiere/distretto (senza chat) 422; location già con un bot 409', async () => {
    const d = 'una cameriera sbrigativa, vedova, che sa tutto del quartiere';
    await rejectsWith(() => prepareDesign(setup().deps, { locationId: 'f'.repeat(24), description: d }), 404);
    await rejectsWith(() => prepareDesign(setup({ loadLocation: async () => ({ ...location, hasChat: false }) }).deps, { locationId: LOC, description: d }), 422, 'INVALID_LOCATION');
    await rejectsWith(() => prepareDesign(setup({}, [{ name: 'Barnaby Finch', characterId: 'b'.repeat(24), locationId: LOC, file: 'x.json', active: true }]).deps, { locationId: LOC, description: d }), 409, 'LOCATION_TAKEN');
  });

  it('manda al servizio solo contenuti della location e i nomi dei bot, non quelli dei giocatori', async () => {
    const { deps, calls } = setup({}, [{ name: 'Barnaby Finch', characterId: 'b'.repeat(24), locationId: 'e'.repeat(24), file: 'x.json', active: true }]);
    const prepared = await prepareDesign(deps, { locationId: LOC, description: 'una cameriera sbrigativa, vedova, che sa tutto del quartiere' });
    await runDesign(deps, prepared);
    const design = calls.find((c) => c.action === 'design')!;
    assert.deepEqual(design.body, {
      description: 'una cameriera sbrigativa, vedova, che sa tutto del quartiere',
      location: { name: 'The Rusty Anchor', quartiere: 'Wapping', district: 'East End', tags: ['Taverna / pub'], description: 'Una taverna di marinai.', positions: ['Bancone'] },
      existingNames: ['Barnaby Finch'],
    });
    assert.ok((design.timeoutMs ?? 0) >= 120_000, 'timeout lungo per una generazione');
  });
});

describe('runDesign (controlli del backend)', () => {
  const prepared = async (deps: BotAdminDeps) => prepareDesign(deps, { locationId: LOC, description: 'una cameriera sbrigativa, vedova, che sa tutto del quartiere' });

  it('aggiunge anacronismi e nome già nel gioco ai controlli del servizio', async () => {
    const bad = draft();
    bad.persona = `${bad.persona} Ha appena comprato una lavatrice.`;
    const { deps } = setup({ call: async (a) => (a === 'list' ? { bots: [] } : { draft: bad, checks: [{ code: 'schema', ok: true }], attempts: 2, ms: 40000 }), nameInUse: async () => true });
    const out = await runDesign(deps, await prepared(deps));
    const failed = out.checks.filter((c) => !c.ok).map((c) => c.code);
    assert.deepEqual(failed.sort(), ['anachronism', 'name-in-game']);
    assert.equal(out.attempts, 2);
  });

  it('una bozza illeggibile (draft null) resta tale e non fa altri controlli', async () => {
    const { deps } = setup({ call: async (a) => (a === 'list' ? { bots: [] } : { draft: null, checks: [{ code: 'schema', ok: false, detail: 'x' }], attempts: 2, ms: 1 }) });
    const out = await runDesign(deps, await prepared(deps));
    assert.equal(out.draft, null);
    assert.deepEqual(out.checks.map((c) => c.code), ['schema']);
  });
});

describe('createBot', () => {
  it('crea il personaggio, poi registra la scheda con il characterId nuovo', async () => {
    const { deps, calls, created, deleted } = setup();
    const r = await createBot(deps, { locationId: LOC, draft: draft() });
    assert.deepEqual(r, { characterId: 'c'.repeat(24), file: 'martha-quill.json', reloaded: true });
    assert.equal(created.length, 1);
    assert.equal(deleted.length, 0);
    const register = calls.find((c) => c.action === 'register')!;
    assert.deepEqual(register.body, { locationId: LOC, sheet: botSheet(draftSchema.parse(draft()), 'c'.repeat(24)) });
  });

  it('se la registrazione fallisce toglie il personaggio appena creato e rilancia l\'errore', async () => {
    const { deps, deleted } = setup({ call: async (a) => { if (a === 'register') throw new AiGatewayError('Questa location ha già un bot', 409, 'location-taken'); return { bots: [] }; } });
    await assert.rejects(() => createBot(deps, { locationId: LOC, draft: draft() }), (e: unknown) => e instanceof AiGatewayError && e.status === 409);
    assert.deepEqual(deleted, ['c'.repeat(24)]);
  });

  it('senza utente di sistema (produzione) non crea nulla: 409', async () => {
    const { deps, created } = setup({ systemUserExists: async () => false });
    await rejectsWith(() => createBot(deps, { locationId: LOC, draft: draft() }), 409, 'NO_SYSTEM_USER');
    assert.equal(created.length, 0);
  });

  it('scheda non valida 400, nome già in uso 409, location occupata 409: nessun personaggio creato', async () => {
    const { deps, created } = setup();
    await rejectsWith(() => createBot(deps, { locationId: LOC, draft: { ...draft(), psyche: { ...draft().psyche, ocean: { O: 500, C: 1, E: 1, A: 1, N: 1 } } } }), 400, 'VALIDATION_ERROR');
    await rejectsWith(() => createBot(setup({ nameInUse: async () => true }).deps, { locationId: LOC, draft: draft() }), 409, 'NAME_TAKEN');
    await rejectsWith(() => createBot(setup({}, [{ name: 'Altro', characterId: 'b'.repeat(24), locationId: LOC, file: 'x.json', active: true }]).deps, { locationId: LOC, draft: draft() }), 409, 'LOCATION_TAKEN');
    assert.equal(created.length, 0);
  });

  it('se la ricarica del servizio non è riuscita lo dice, ma il bot esiste', async () => {
    const { deps } = setup({ call: async (a) => (a === 'register' ? { file: 'martha-quill.json', reloaded: false } : { bots: [] }) });
    assert.equal((await createBot(deps, { locationId: LOC, draft: draft() })).reloaded, false);
  });
});
