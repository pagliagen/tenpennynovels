import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorialService } from '../service';
import { clampTokens } from '../limits';
import { BoundedQueue, QueueFullError } from '../queue';
import type { Llm } from '../../shared/ollama';
import type { EditorialConfig } from '../config';

const config: EditorialConfig = { ollamaUrl: 'http://localhost:11434', model: 'gemma4:12b', maxQueue: 1, maxTokens: 500 };

/** Un modello finto che registra le chiamate e può essere bloccato. */
function fakeLlm(over: Partial<Llm> = {}): Llm & { calls: { numPredict: number }[] } {
  const calls: { numPredict: number }[] = [];
  return {
    calls,
    generate: async (_m, opts) => { calls.push({ numPredict: opts.numPredict }); return 'Una bozza di prova.'; },
    generateJson: async (_m, _s, opts) => { calls.push({ numPredict: opts.numPredict }); return { description: 'Una bozza.' }; },
    ...over,
  };
}

const call = (service: ReturnType<typeof createEditorialService>, body: unknown) => service.routes!['generate']!(body);

test('genera un testo e restituisce solo testo e tempo, mai il modello né i parametri', async () => {
  const service = createEditorialService({ config, llm: fakeLlm() });
  const res = await call(service, { system: 'Sei un editor.', user: 'Descrivi un pub.' });
  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  assert.equal(body['text'], 'Una bozza di prova.');
  assert.ok(typeof body['ms'] === 'number');
  assert.deepEqual(Object.keys(body).sort(), ['ms', 'text']);
});

test('con uno schema usa l\'output vincolato e risponde con json', async () => {
  const service = createEditorialService({ config, llm: fakeLlm() });
  const res = await call(service, { system: 's', user: 'u', schema: { type: 'object', properties: { description: { type: 'string' } } } });
  assert.deepEqual((res.body as { json: unknown }).json, { description: 'Una bozza.' });
});

test('richieste non valide: 400 senza dettagli; il modello non si sceglie dalla richiesta', async () => {
  const llm = fakeLlm();
  const service = createEditorialService({ config, llm });
  for (const body of [{}, { system: '', user: 'x' }, { system: 'x', user: 'y'.repeat(20_001) }, { system: 'x', user: 'y', schema: 'no' }, null, 'testo']) {
    const res = await call(service, body);
    assert.equal(res.status, 400, JSON.stringify(body)?.slice(0, 40));
    assert.deepEqual(res.body, { error: 'Richiesta non valida' });
  }
  // Un campo `model` in più viene semplicemente ignorato: la generazione parte comunque col modello del servizio.
  const ok = await call(service, { system: 'a', user: 'b', model: 'qualcosa-di-enorme' });
  assert.equal(ok.status, 200);
});

test('maxTokens: il tetto del servizio vale sempre', async () => {
  const llm = fakeLlm();
  const service = createEditorialService({ config, llm });
  await call(service, { system: 'a', user: 'b', maxTokens: 100_000 });
  await call(service, { system: 'a', user: 'b', maxTokens: 50 });
  await call(service, { system: 'a', user: 'b' });
  assert.deepEqual(llm.calls.map((c) => c.numPredict), [500, 50, 500]);
  assert.equal(clampTokens(undefined, 300), 300);
  assert.equal(clampTokens(undefined, 1200), 600);
});

test('coda piena: la richiesta in eccesso riceve 429 subito, quelle accodate completano', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const service = createEditorialService({ config: { ...config, maxQueue: 1 }, llm: fakeLlm({ generate: async () => { await gate; return 'ok'; } }) });

  const first = call(service, { system: 'a', user: 'b' });   // in corso
  const second = call(service, { system: 'a', user: 'b' });  // in attesa
  const third = await call(service, { system: 'a', user: 'b' }); // oltre: rifiutata
  assert.equal(third.status, 429);

  release();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
});

test('errore del modello: 502 con un messaggio generico, mai il dettaglio', async () => {
  const service = createEditorialService({ config, llm: fakeLlm({ generate: async () => { throw new Error('Ollama 500: PROMPT SEGRETO ...'); } }) });
  const res = await call(service, { system: 'a', user: 'b' });
  assert.equal(res.status, 502);
  assert.doesNotMatch(JSON.stringify(res.body), /SEGRETO|Ollama/);
});

test('health: sano solo se Ollama risponde e ha il modello', async () => {
  const ok = createEditorialService({ config, llm: fakeLlm(), check: async () => ({ ok: true }) });
  assert.deepEqual(await ok.health(), { ok: true });
  const ko = createEditorialService({ config, llm: fakeLlm(), check: async () => ({ ok: false, reason: 'modello gemma4:12b non installato' }) });
  assert.deepEqual(await ko.health(), { ok: false, reason: 'modello gemma4:12b non installato' });
});

test('BoundedQueue: con zero in attesa ammette una sola richiesta alla volta', async () => {
  const q = new BoundedQueue(0);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const running = q.run(async () => { await gate; return 1; });
  await assert.rejects(() => q.run(async () => 2), QueueFullError);
  release();
  assert.equal(await running, 1);
  assert.equal(await q.run(async () => 3), 3);
});
