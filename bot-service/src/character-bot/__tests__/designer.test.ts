import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDesignPrompt, checkDraft, designBot, MAX_ATTEMPTS, tidyText, type DesignContext } from '../designer';
import type { Llm } from '../../shared/ollama';

const ctx: DesignContext = {
  description: 'una cameriera sbrigativa, vedova, che sa tutto del quartiere',
  location: { name: 'The Rusty Anchor', quartiere: 'Wapping', district: 'East End', tags: ['Taverna / pub'], description: 'Una taverna di marinai vicino ai moli.', positions: ['Bancone'] },
  existingNames: ['Barnaby Finch'],
};

const PERSONA = 'Sei una cameriera sbrigativa del Rusty Anchor, vedova da molti anni. Servi i tavoli senza fermarti e hai sempre una battuta secca pronta. Sai tutto quello che succede a Wapping perché ascolti ogni conversazione. Con gli sconosciuti sei diffidente finché non vedi i soldi sul bancone. Racconti i pettegolezzi solo a chi ti tratta con rispetto. Parli veloce, a frasi corte.';

const good = (over: Record<string, unknown> = {}) => ({
  character: {
    name: 'Martha Quill', firstName: 'Martha', surname: 'Quill', gender: 'female', age: 41, apparentAge: 46,
    height: '1.62m', eyeColor: 'castani', hairColor: 'grigi', visibleMarks: '',
    physicalDescription: 'Donna magra dal viso segnato, sempre con un grembiule stretto in vita. Si muove tra i tavoli senza mai fermarsi.',
    publicDescription: 'Una cameriera dall\'aria stanca e dagli occhi attenti.',
  },
  persona: PERSONA,
  psyche: { ocean: { O: 40, C: 75, E: 55, A: 35, N: 50 }, enneagram: { type: 6, fear: 'restare sola e senza mezzi', desire: 'avere un posto sicuro' }, pad: { p: -0.1, a: 0.2, d: 0.3 } },
  ...over,
});

const llmOf = (...responses: unknown[]): Llm & { calls: number } => {
  let i = 0;
  return {
    calls: 0,
    generate: async () => '',
    generateJson: async function () { (this as { calls: number }).calls++; const r = responses[Math.min(i++, responses.length - 1)]; if (r instanceof Error) throw r; return r; },
  };
};

const failed = (checks: { code: string; ok: boolean }[]) => checks.filter((c) => !c.ok).map((c) => c.code);

test('una scheda coerente supera tutti i controlli', () => {
  const { draft, checks } = checkDraft(good(), ctx);
  assert.ok(draft);
  assert.deepEqual(failed(checks), []);
});

test('numeri fuori scala o forma sbagliata: schema non superato e nessuna bozza', () => {
  const bad = good({ psyche: { ocean: { O: 140, C: 75, E: 55, A: 35, N: 50 }, enneagram: { type: 12, fear: 'x', desire: 'y' }, pad: { p: 3, a: 0, d: 0 } } });
  const r = checkDraft(bad, ctx);
  assert.equal(r.draft, null);
  assert.deepEqual(failed(r.checks), ['schema']);
});

test('descrizioni in seconda persona e troppo lunghe: avvisi, non una scheda scartata', () => {
  const c = good().character;
  const r = checkDraft(good({ character: { ...c, physicalDescription: 'Hai le spalle larghe e ti muovi con lentezza tra i tavoli, sempre con le mani occupate.', publicDescription: 'x '.repeat(200) } }), ctx);
  assert.ok(r.draft, 'la bozza c\'è comunque');
  assert.deepEqual(failed(r.checks).sort(), ['lengths', 'third-person']);
});

test('persona: deve iniziare con «Sei», avere 5-8 frasi, niente anni', () => {
  assert.ok(failed(checkDraft(good({ persona: PERSONA.replace('Sei una', 'Una') }), ctx).checks).includes('second-person'));
  const short = 'Sei una cameriera sbrigativa che lavora in una taverna di marinai e ha sempre una battuta pronta per tutti. Parla veloce e ascolta molto. '.repeat(2).slice(0, 220);
  assert.ok(failed(checkDraft(good({ persona: short }), ctx).checks).includes('persona-length'));
  assert.ok(failed(checkDraft(good({ persona: `${PERSONA} Lavora lì dal 1881.` }), ctx).checks).includes('years'));
});

test('un nome proprio che non viene dal personaggio né dal luogo è segnalato', () => {
  const invented = PERSONA.replace('Servi i tavoli', 'Servi i tavoli, e ti fidi solo di Jack Hobbs,');
  assert.ok(failed(checkDraft(good({ persona: invented }), ctx).checks).includes('unknown-name'));
  assert.deepEqual(failed(checkDraft(good(), ctx).checks), []); // Wapping e Rusty Anchor vengono dal luogo
});

test('nome già usato, nome e cognome incoerenti, età apparente lontana', () => {
  const c = good().character;
  assert.ok(failed(checkDraft(good({ character: { ...c, name: 'barnaby  finch', firstName: 'Barnaby', surname: 'Finch' } }), ctx).checks).includes('name-unique'));
  assert.ok(failed(checkDraft(good({ character: { ...c, firstName: 'Ruth' } }), ctx).checks).includes('name-consistent'));
  assert.ok(failed(checkDraft(good({ character: { ...c, age: 30, apparentAge: 55 } }), ctx).checks).includes('age'));
});

test('designBot si ferma al primo tentativo senza difetti', async () => {
  const llm = llmOf(good());
  const r = await designBot(llm, ctx);
  assert.equal(r.attempts, 1);
  assert.equal(llm.calls, 1);
  assert.ok(r.draft);
});

test('riprova se la prima scheda ha difetti e prende la buona', async () => {
  const llm = llmOf(good({ persona: `${PERSONA} Lavora lì dal 1881.` }), good());
  const r = await designBot(llm, ctx);
  assert.equal(r.attempts, 2);
  assert.equal(MAX_ATTEMPTS, 2);
  assert.deepEqual(failed(r.checks), []);
});

test('se nessun tentativo è pulito restituisce quello con meno difetti, e i difetti', async () => {
  const two = good({ persona: `${PERSONA} Lavora lì dal 1881.`, character: { ...good().character, firstName: 'Ruth' } });
  const one = good({ persona: `${PERSONA} Lavora lì dal 1881.` });
  const llm = llmOf(two, one);
  const r = await designBot(llm, ctx);
  assert.equal(r.attempts, MAX_ATTEMPTS);
  assert.deepEqual(failed(r.checks), ['years']);
});

test('errore del modello: propaga solo se non c\'è nessuna bozza', async () => {
  await assert.rejects(() => designBot(llmOf(new Error('giù')), ctx), /giù/);
  const r = await designBot(llmOf(good({ persona: `${PERSONA} Dal 1881.` }), new Error('giù'), new Error('giù')), ctx);
  assert.ok(r.draft);
});

test('il prompt non contiene esempi con nomi propri e porta il contesto del luogo', () => {
  const { system, user } = buildDesignPrompt(ctx);
  assert.doesNotMatch(system, /Martha|John|Barnaby|Rusty|Wapping/);
  assert.match(user, /Rusty Anchor, Wapping, East End/);
  assert.match(user, /GIÀ usati.*Barnaby Finch/);
  assert.match(user, /DESCRIZIONE DELL'AUTORE: una cameriera/);
});

test('tidyText toglie virgole e spazi spurii in coda e chiude la frase', () => {
  assert.equal(tidyText('Un giovane sporco di scaglie e acqua.,'), 'Un giovane sporco di scaglie e acqua.');
  assert.equal(tidyText('  Un uomo   alto ; '), 'Un uomo alto.');
  assert.equal(tidyText('Già finita!'), 'Già finita!');
  assert.equal(tidyText(''), '');
});

test('la bozza che arriva dal controllo è già ripulita', () => {
  const c = good().character;
  const { draft } = checkDraft(good({ character: { ...c, publicDescription: 'Una cameriera dall\'aria stanca.,', visibleMarks: 'una cicatrice,' } }), ctx);
  assert.equal(draft!.character.publicDescription, 'Una cameriera dall\'aria stanca.');
  assert.equal(draft!.character.visibleMarks, 'una cicatrice');
});
