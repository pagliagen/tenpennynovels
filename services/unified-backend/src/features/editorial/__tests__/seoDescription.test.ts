import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AiGatewayError } from '../../../core/ai/AiGatewayClient';
import { InsufficientInputError } from '../services/LocationSuggestionService';
import { DocumentNotFoundError, generateSeoDescription, MAX_SEO_ATTEMPTS, SeoChecksFailedError, type SeoDeps } from '../services/SeoDescriptionService';
import { SEO_MAX_CHARS, SEO_MIN_CHARS, validateSeoDescription } from '../utils/validators';
import { buildSeoPrompt } from '../utils/prompts';

const SOURCE = 'Southwark è un quartiere a sud del Tamigi collegato alla città da antichi ponti. Qui si trovano taverne storiche, magazzini e il grande mercato alimentare. '.repeat(3);
const GOOD = 'Southwark, il quartiere a sud del Tamigi collegato alla città da antichi ponti: taverne storiche, magazzini e il grande mercato alimentare.';

const doc = (over: Partial<NonNullable<Awaited<ReturnType<SeoDeps['load']>>>> = {}) => ({
  _id: 'd1', title: 'Southwark', type: 'ambientazione', path: '/ambientazione/southwark', description: 'DESCRIZIONE VECCHIA', text: SOURCE, ...over,
});

function deps(responses: unknown[], over: Partial<SeoDeps> = {}) {
  const calls = { generate: [] as { system: string; user: string }[], saved: [] as string[] };
  let i = 0;
  const d: SeoDeps = {
    load: async () => doc(),
    generate: async (r) => { calls.generate.push(r); return { json: responses[Math.min(i++, responses.length - 1)], ms: 1000 }; },
    save: async (_id, description) => { calls.saved.push(description); return { previous: 'DESCRIZIONE VECCHIA' }; },
    ...over,
  };
  return { d, calls };
}

describe('validateSeoDescription', () => {
  const ctx = { title: 'Southwark', source: SOURCE };

  it('una descrizione fedele al testo, di lunghezza giusta, passa', () => {
    assert.ok(GOOD.length >= SEO_MIN_CHARS && GOOD.length <= SEO_MAX_CHARS, `${GOOD.length}`);
    assert.equal(validateSeoDescription(GOOD, ctx).ok, true);
  });

  it('troppo corta o troppo lunga', () => {
    assert.equal(validateSeoDescription('Il quartiere a sud del Tamigi.', ctx).checks.find((c) => c.code === 'length')!.ok, false);
    assert.equal(validateSeoDescription(`${GOOD} ${GOOD}`, ctx).checks.find((c) => c.code === 'length')!.ok, false);
  });

  it('un anno lo ammette solo se il documento lo cita', () => {
    const withYear = `${GOOD.slice(0, 100)} nel 1895, antichi ponti e taverne.`;
    assert.equal(validateSeoDescription(withYear, ctx).checks.find((c) => c.code === 'year')!.ok, false);
    assert.equal(validateSeoDescription(withYear, { ...ctx, source: `${SOURCE} Nel 1895 tutto cambiò.` }).checks.find((c) => c.code === 'year')!.ok, true);
  });

  it('un nome proprio che il documento non cita è segnalato', () => {
    const invented = 'Southwark, quartiere a sud del Tamigi dove Lord Hobbs possiede le taverne storiche, i magazzini e il grande mercato alimentare.';
    assert.equal(validateSeoDescription(invented, ctx).checks.find((c) => c.code === 'unknown-name')!.ok, false);
  });

  it('parlare del gioco non è un difetto: la pagina può presentarlo', () => {
    const meta = 'Southwark, quartiere a sud del Tamigi: i giocatori del gioco di ruolo trovano taverne storiche, magazzini e il grande mercato alimentare.';
    assert.equal(validateSeoDescription(meta, ctx).checks.some((c) => c.code === 'game-meta'), false);
  });
});

describe('generateSeoDescription', () => {
  it('genera dal titolo e dal testo, salva e restituisce anche la descrizione precedente', async () => {
    const { d, calls } = deps([{ description: GOOD }]);
    const r = await generateSeoDescription('d1', d);
    assert.equal(r.description, GOOD);
    assert.equal(r.previous, 'DESCRIZIONE VECCHIA');
    assert.equal(r.attempts, 1);
    assert.deepEqual(calls.saved, [GOOD]);
    assert.match(calls.generate[0]!.user, /Titolo: Southwark/);
    assert.match(calls.generate[0]!.user, /antichi ponti/);
  });

  it('la descrizione attuale non entra nel prompt', async () => {
    const { d, calls } = deps([{ description: GOOD }]);
    await generateSeoDescription('d1', d);
    assert.doesNotMatch(`${calls.generate[0]!.system}${calls.generate[0]!.user}`, /DESCRIZIONE VECCHIA/);
  });

  it('se la prima bozza non passa i controlli riprova, e salva solo quella buona', async () => {
    const { d, calls } = deps([{ description: 'Troppo corta.' }, { description: GOOD }]);
    const r = await generateSeoDescription('d1', d);
    assert.equal(r.attempts, 2);
    assert.equal(r.ms, 2000);
    assert.deepEqual(calls.saved, [GOOD]);
  });

  it('se nessuna bozza passa non salva niente e dice quali controlli sono falliti', async () => {
    const { d, calls } = deps([{ description: 'Troppo corta.' }]);
    await assert.rejects(() => generateSeoDescription('d1', d), (e: unknown) => e instanceof SeoChecksFailedError && e.attempts === MAX_SEO_ATTEMPTS && e.checks.some((c) => c.code === 'length' && !c.ok));
    assert.equal(calls.saved.length, 0);
    assert.equal(calls.generate.length, MAX_SEO_ATTEMPTS);
  });

  it('con poco testo non c\'è da dove ricavarla: nessuna chiamata al modello', async () => {
    const { d, calls } = deps([{ description: GOOD }], { load: async () => doc({ text: 'Poche parole.' }) });
    await assert.rejects(() => generateSeoDescription('d1', d), InsufficientInputError);
    assert.equal(calls.generate.length, 0);
  });

  it('documento inesistente o non pubblico', async () => {
    const { d } = deps([{ description: GOOD }], { load: async () => null });
    await assert.rejects(() => generateSeoDescription('d1', d), DocumentNotFoundError);
  });

  it('forma sbagliata dal modello = errore 502, e non salva', async () => {
    const { d, calls } = deps([{ description: 5 }]);
    await assert.rejects(() => generateSeoDescription('d1', d), AiGatewayError);
    assert.equal(calls.saved.length, 0);
  });

  it('toglie virgolette e spazi doppi prima di controllare e salvare', async () => {
    const { d, calls } = deps([{ description: `«${GOOD.replace(' ', '  ')}»` }]);
    await generateSeoDescription('d1', d);
    assert.deepEqual(calls.saved, [GOOD]);
  });
});

describe('buildSeoPrompt', () => {
  it('non contiene esempi con nomi propri né la descrizione precedente', () => {
    const { system } = buildSeoPrompt({ title: 'X', type: 'ambientazione', text: 'testo' });
    assert.doesNotMatch(system, /Londra,|John|Southwark/);
    assert.match(system, /MAI oltre 160/);
  });
});
