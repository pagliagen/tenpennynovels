/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/editorial/__tests__/locationSuggestion.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AiGatewayError } from '../../../core/ai/AiGatewayClient';
import { LOCATION_TAGS } from '../../../core/location/constants/locationTags';
import { LocationNotFoundError, suggestDescription, suggestTags, type SuggestDeps, type SuggestionContext } from '../services/LocationSuggestionService';
import { buildDescriptionPrompt, buildTagsPrompt, TAGS_SCHEMA } from '../utils/prompts';
import { foreignWords, lostNames, unknownProperNames, validateDescription } from '../utils/validators';
import { clipToSentence } from '../utils/text';

const ctx: SuggestionContext = {
  name: 'Ten Bells Public House', quartiere: 'Whitechapel', district: 'East End', tagLabels: ['Taverna / pub'],
  currentDescription: 'Una taverna popolare frequentata da lavoratori del mercato e residenti locali.',
  passages: [{ title: 'La città', text: 'Nel 1895 Londra è il centro politico ed economico dell\'Impero britannico, segnata da forti contrasti sociali.' }],
  styleExamples: [{ name: 'Ratcliff Highway', description: 'Una strada malfamata piena di bettole e pensioni per marinai di passaggio.' }],
  canonYear: 1895,
  knownText: 'Ten Bells Public House Whitechapel East End Taverna / pub Una taverna popolare frequentata da lavoratori del mercato e residenti locali.',
};

const GOOD = 'Una taverna fumosa nel cuore di Whitechapel, dove i lavoratori del mercato si ritrovano a fine giornata. Il bancone è consumato dai gomiti e il chiacchiericcio non smette mai.';

const deps = (json: unknown, over: Partial<SuggestDeps> = {}): SuggestDeps & { requests: { system: string; user: string; schema?: unknown; maxTokens?: number }[] } => {
  const requests: { system: string; user: string; schema?: unknown; maxTokens?: number }[] = [];
  return {
    requests,
    loadContext: async () => ctx,
    generate: async (request) => { requests.push(request); return { json, ms: 1234 }; },
    ...over,
  };
};

describe('validateDescription', () => {
  const v = (text: string) => validateDescription(text, { knownText: ctx.knownText, canonYear: 1895 });

  it('una bozza pulita passa tutti i controlli', () => {
    const r = v(GOOD);
    assert.equal(r.ok, true);
    assert.deepEqual(r.checks.map((c) => c.code), ['length', 'year', 'anachronism', 'foreign-words', 'unknown-name', 'lost-facts', 'game-meta']);
  });

  it('lunghezza fuori misura', () => {
    assert.equal(v('Troppo corta.').checks.find((c) => c.code === 'length')!.ok, false);
    assert.equal(v('x '.repeat(300)).checks.find((c) => c.code === 'length')!.ok, false);
  });

  it('un anno diverso dal canone è segnalato, quello del canone no', () => {
    assert.equal(v(`${GOOD} Nel 1889 era già così.`).checks.find((c) => c.code === 'year')!.ok, false);
    assert.equal(v(`${GOOD} Nel 1895 era già così.`).checks.find((c) => c.code === 'year')!.ok, true);
  });

  it('anacronismi e testo di gioco', () => {
    assert.equal(v(`${GOOD} Qualcuno controlla il cellulare.`).checks.find((c) => c.code === 'anachronism')!.ok, false);
    assert.equal(v(`${GOOD} I giocatori vi si incontrano.`).checks.find((c) => c.code === 'game-meta')!.ok, false);
  });

  it('nomi propri inventati sì, nomi del contesto e inizio frase no', () => {
    assert.deepEqual(unknownProperNames('Una taverna vicino al molo di Cutler, gestita da Mrs Halloway.', ctx.knownText), ['Cutler', 'Halloway']);
    assert.deepEqual(unknownProperNames('Whitechapel è vicino. *Guarda Londra.* Il Tamigi scorre.', ctx.knownText), []);
  });
});

describe('foreignWords', () => {
  it('trova le parole straniere minuscole ma non i nomi propri', () => {
    assert.deepEqual(foreignWords('Tra i boulevard illuminati e il terminal affollato.'), ['boulevard', 'terminal']);
    assert.deepEqual(foreignWords('Borough Market e Baker Street restano nomi propri.'), []);
  });
});

describe('lostNames', () => {
  it('segnala i nomi propri della descrizione attuale che la bozza non riporta', () => {
    const old = 'La grande stazione ferroviaria in ferro e vetro, progettata da Brunel, brulicante di vapore.';
    assert.deepEqual(lostNames('Una maestosa stazione in ferro e vetro dove il vapore si mescola alla folla.', old), ['Brunel']);
    assert.deepEqual(lostNames('Una stazione in ferro e vetro progettata da Brunel, tra vapore e folla.', old), []);
  });

  it('non conta le parole a inizio frase né quelle di sfondo', () => {
    assert.deepEqual(lostNames('Una taverna.', 'Una taverna storica a Londra, di Whitechapel.'), ['Whitechapel']);
  });

  it('è un controllo della bozza: se perde un fatto, lost-facts fallisce', () => {
    const r = validateDescription(GOOD, { knownText: ctx.knownText, canonYear: 1895, currentDescription: 'Una taverna progettata da Hawksmoor, frequentata da lavoratori.' });
    assert.equal(r.checks.find((c) => c.code === 'lost-facts')!.ok, false);
    assert.equal(r.ok, false);
  });
});

describe('prompt', () => {
  it('descrizione: contesto, regole e solo contenuti pubblici', () => {
    const { system, user } = buildDescriptionPrompt(ctx);
    assert.match(system, /1895/);
    assert.match(system, /NON inventare nomi propri/);
    assert.match(system, /non parlare del gioco/i);
    assert.match(system, /conserva TUTTI i fatti/);
    assert.match(system, /NON iniziare ripetendo il nome/);
    assert.doesNotMatch(system, /salvo il 1895/);
    assert.match(user, /Ten Bells Public House, Whitechapel, East End/);
    assert.match(user, /Taverna \/ pub/);
    assert.match(user, /Esempi di stile/);
    assert.match(user, /Nel 1895 Londra è il centro/);
  });

  it('tag: elenco chiuso con i significati, e lo schema accetta solo tag del registro', () => {
    const { system } = buildTagsPrompt(ctx);
    for (const tag of LOCATION_TAGS) assert.match(system, new RegExp(`- ${tag}:`));
    assert.deepEqual(TAGS_SCHEMA.properties.tags.items.enum, [...LOCATION_TAGS]);
  });
});

describe('suggestDescription', () => {
  it('restituisce bozza, controlli e fonti, e chiede l\'output vincolato con un tetto di token', async () => {
    const d = deps({ description: GOOD });
    const r = await suggestDescription('id', d);
    assert.equal(r.draft, GOOD);
    assert.equal(r.ok, true);
    assert.deepEqual(r.sources, ['La città']);
    assert.equal(r.ms, 1234);
    assert.ok(d.requests[0]!.schema);
    assert.equal(d.requests[0]!.maxTokens, 300);
  });

  it('una bozza con difetti arriva comunque, con i controlli falliti (decide la persona)', async () => {
    const r = await suggestDescription('id', deps({ description: `${GOOD} Si paga con il cellulare nel 1889.` }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.checks.filter((c) => !c.ok).map((c) => c.code).sort(), ['anachronism', 'year']);
  });

  it('forma sbagliata dal modello = errore 502 in italiano', async () => {
    for (const json of [{}, { description: '' }, { description: 5 }, null, 'testo']) {
      await assert.rejects(() => suggestDescription('id', deps(json)), (e: unknown) => e instanceof AiGatewayError && e.status === 502 && /non valida/.test(e.userMessage));
    }
  });

  it('location inesistente e errori del gateway si propagano', async () => {
    await assert.rejects(() => suggestDescription('id', deps({}, { loadContext: async () => null })), LocationNotFoundError);
    await assert.rejects(
      () => suggestDescription('id', deps({}, { generate: async () => { throw new AiGatewayError('Il servizio AI è occupato: riprova fra poco.', 429); } })),
      (e: unknown) => e instanceof AiGatewayError && e.status === 429,
    );
  });
});

describe('suggestTags', () => {
  it('tiene solo i tag del registro, anche se il modello ne inventa', async () => {
    const r = await suggestTags('id', deps({ tags: ['taverna', 'castello', 'alloggio', 'taverna'] }));
    assert.deepEqual(r.tags, ['taverna', 'alloggio']);
  });

  it('forma sbagliata = 502', async () => {
    await assert.rejects(() => suggestTags('id', deps({ tags: 'taverna' })), (e: unknown) => e instanceof AiGatewayError && e.status === 502);
  });
});

describe('clipToSentence', () => {
  it('non spezza una frase a metà', () => {
    assert.equal(clipToSentence('Una frase intera. Un\'altra frase che sfora il limite.', 25), 'Una frase intera.');
  });
});
