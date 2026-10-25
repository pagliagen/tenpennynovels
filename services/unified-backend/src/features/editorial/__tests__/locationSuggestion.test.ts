/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/editorial/__tests__/locationSuggestion.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AiGatewayError } from '../../../core/ai/AiGatewayClient';
import { LOCATION_TAGS } from '../../../core/location/constants/locationTags';
import { hasEnoughInput, InsufficientInputError, LocationNotFoundError, suggestDescription, suggestTags, type SuggestDeps, type SuggestionContext } from '../services/LocationSuggestionService';
import { splitAuthorNote } from '../utils/text';
import { suggestPositions } from '../services/LocationSuggestionService';
import { cleanPositions, MIN_DESCRIPTION_CHARS } from '../utils/validators';
import { MIN_LOCATION_DESCRIPTION_CHARS } from '../utils/canonRules';
import { buildDescriptionPrompt, buildTagsPrompt, lengthTarget, TAGS_SCHEMA } from '../utils/prompts';
import { foreignWords, lostNames, missingContent, unknownProperNames, validateDescription } from '../utils/validators';
import { clipToSentence } from '../utils/text';

const ctx: SuggestionContext = {
  name: 'Ten Bells Public House', quartiere: 'Whitechapel', district: 'East End', tagLabels: ['Taverna / pub'],
  currentDescription: 'Una taverna popolare frequentata da lavoratori del mercato e residenti locali.',
  passages: [{ title: 'La città', text: 'Nel 1895 Londra è il centro politico ed economico dell\'Impero britannico, segnata da forti contrasti sociali.' }],
  styleExamples: [{ name: 'Ratcliff Highway', description: 'Una strada malfamata piena di bettole e pensioni per marinai di passaggio.' }],
  canonYear: 1895,
  knownText: 'Ten Bells Public House Whitechapel East End Taverna / pub Una taverna popolare frequentata da lavoratori del mercato e residenti locali.',
};

const GOOD = 'Una taverna popolare frequentata da lavoratori del mercato e residenti locali, con il fumo che ristagna sotto il soffitto basso. Il bancone è consumato dai gomiti e le voci non smettono mai.';

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
    assert.deepEqual(r.checks.map((c) => c.code), ['length', 'year', 'anachronism', 'foreign-words', 'unknown-name', 'lost-facts', 'variable-conditions', 'invented-material', 'filler', 'game-meta']);
  });

  it('meteo, ora e luce che l\'autore non ha scritto sono segnalati; quelli suoi no', () => {
    const base = 'Lo storico quartiere a sud del Tamigi, collegato da antichi ponti.';
    const withFog = 'Lo storico quartiere a sud del Tamigi, collegato da antichi ponti, resta avvolto nelle nebbie.';
    const check = (d: string, code: string, b = base) => validateDescription(d, { knownText: b, canonYear: 1895, currentDescription: b }).checks.find((c) => c.code === code)!;
    assert.equal(check(withFog, 'variable-conditions').ok, false);
    assert.match(check(withFog, 'variable-conditions').detail!, /nebbie/);
    assert.equal(check(withFog, 'variable-conditions', `${base} Sempre nebbie sul fiume.`).ok, true);
  });

  it('un materiale non scritto dall\'autore è segnalato («ponti di pietra»), se c\'è già no', () => {
    const base = 'Lo storico quartiere a sud del Tamigi, collegato da antichi ponti.';
    const draft = 'Lo storico quartiere a sud del Tamigi, collegato da antichi ponti di pietra.';
    const r = validateDescription(draft, { knownText: base, canonYear: 1895, currentDescription: base }).checks.find((c) => c.code === 'invented-material')!;
    assert.equal(r.ok, false);
    const ok = validateDescription(draft, { knownText: base, canonYear: 1895, currentDescription: `${base} Ponti di pietra.` }).checks.find((c) => c.code === 'invented-material')!;
    assert.equal(ok.ok, true);
  });

  it('le frasi fatte sono segnalate', () => {
    const base = 'Un mercato di pesce vicino al fiume, aperto all\'alba.';
    const r = validateDescription('Un mercato di pesce vicino al fiume. L\'aria è densa di odori e le voci sono costanti.', { knownText: base, canonYear: 1895, currentDescription: base }).checks.find((c) => c.code === 'filler')!;
    assert.equal(r.ok, false);
  });

  it('«Per l\'AI: …» è una nota: non si espande e non conta come fatti persi', async () => {
    const text = 'Lo storico quartiere a sud del Tamigi, collegato da antichi ponti. Per l\'AI: Aggiungi location interessanti con una breve descrizione.';
    assert.deepEqual(splitAuthorNote(text), { base: 'Lo storico quartiere a sud del Tamigi, collegato da antichi ponti.', note: 'Aggiungi location interessanti con una breve descrizione.' });
    assert.equal(splitAuthorNote('Una locanda.').note, '');
    const d = deps({ description: 'Lo storico quartiere a sud del Tamigi, collegato da antichi ponti, è un labirinto di vicoli.' });
    const r = await suggestDescription('id', { description: text }, d);
    assert.equal(r.checks.find((c) => c.code === 'lost-facts')!.ok, true);
    assert.match(d.requests[0]!.user, /NOTA DELL'AUTORE PER TE/);
    assert.doesNotMatch(d.requests[0]!.user, /TESTO DELL'AUTORE[^\n]*Aggiungi location/);
  });

  it('la soglia minima è quella della revisione di canone, così una bozza valida non finisce fra i problemi', () => {
    assert.equal(MIN_DESCRIPTION_CHARS, MIN_LOCATION_DESCRIPTION_CHARS);
    assert.equal(v('x '.repeat(55).trim()).checks.find((c) => c.code === 'length')!.ok, false); // 109 caratteri
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
    assert.match(system, /ESPANDERE/);
    assert.match(system, /NON aggiungere fatti nuovi/);
    assert.match(system, /non parlare del gioco/i);
    assert.match(system, /UNICA fonte dei fatti/);
    assert.match(system, /NON iniziare ripetendo il nome/);
    assert.doesNotMatch(system, /salvo il 1895/);
    assert.match(user, /Ten Bells Public House, Whitechapel, East End/);
    assert.match(user, /Taverna \/ pub/);
    assert.match(user, /Esempi di tono/);
    assert.match(user, /TESTO DELL'AUTORE \(da espandere, senza perdere nulla\): Una taverna popolare/);
    assert.match(user, /Sfondo storico generale \(NON attribuire al luogo/);
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
    const r = await suggestDescription('id', {}, d);
    assert.equal(r.draft, GOOD);
    assert.equal(r.ok, true);
    assert.deepEqual(r.sources, ['La città']);
    assert.equal(r.ms, 1234);
    assert.ok(d.requests[0]!.schema);
    assert.equal(d.requests[0]!.maxTokens, 300);
  });

  it('una bozza con difetti arriva comunque, con i controlli falliti (decide la persona)', async () => {
    const r = await suggestDescription('id', {}, deps({ description: `${GOOD} Si paga con il cellulare nel 1889.` }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.checks.filter((c) => !c.ok).map((c) => c.code).sort(), ['anachronism', 'year']);
  });

  it('forma sbagliata dal modello = errore 502 in italiano', async () => {
    for (const json of [{}, { description: '' }, { description: 5 }, null, 'testo']) {
      await assert.rejects(() => suggestDescription('id', {}, deps(json)), (e: unknown) => e instanceof AiGatewayError && e.status === 502 && /non valida/.test(e.userMessage));
    }
  });

  it('location inesistente e errori del gateway si propagano', async () => {
    await assert.rejects(() => suggestDescription('id', {}, deps({}, { loadContext: async () => null })), LocationNotFoundError);
    await assert.rejects(
      () => suggestDescription('id', {}, deps({}, { generate: async () => { throw new AiGatewayError('Il servizio AI è occupato: riprova fra poco.', 429); } })),
      (e: unknown) => e instanceof AiGatewayError && e.status === 429,
    );
  });
});

describe('suggestTags', () => {
  it('tiene solo i tag del registro, anche se il modello ne inventa', async () => {
    const r = await suggestTags('id', {}, deps({ tags: ['taverna', 'castello', 'alloggio', 'taverna'] }));
    assert.deepEqual(r.tags, ['taverna', 'alloggio']);
  });

  it('forma sbagliata = 502', async () => {
    await assert.rejects(() => suggestTags('id', {}, deps({ tags: 'taverna' })), (e: unknown) => e instanceof AiGatewayError && e.status === 502);
  });
});

describe('clipToSentence', () => {
  it('non spezza una frase a metà', () => {
    assert.equal(clipToSentence('Una frase intera. Un\'altra frase che sfora il limite.', 25), 'Una frase intera.');
  });
});

describe('espandere, non inventare', () => {
  it('senza un minimo di testo non c\'è niente da espandere: errore e nessuna chiamata al modello', async () => {
    const d = deps({ description: GOOD });
    for (const description of ['', '   ', 'Una strada.', 'Una taverna.']) {
      await assert.rejects(() => suggestDescription('id', { description }, d), (e: unknown) => e instanceof InsufficientInputError && /Scrivi prima almeno una frase/.test(e.message));
    }
    assert.equal(d.requests.length, 0);
    assert.equal(hasEnoughInput('Una taverna popolare frequentata da lavoratori.'), true);
    assert.equal(hasEnoughInput('Una taverna fumosa.'), false, 'meno di 4 parole');
  });

  it('la base è il testo nel form (anche non salvato), non quello su DB', async () => {
    const d = deps({ description: 'Una taverna di portuali con il bancone di zinco e il fumo sempre alto.' });
    await suggestDescription('id', { description: 'Taverna di portuali con bancone di zinco, sempre fumosa.' }, d);
    assert.match(d.requests[0]!.user, /TESTO DELL'AUTORE[^\n]*Taverna di portuali con bancone di zinco/);
    assert.doesNotMatch(d.requests[0]!.user, /lavoratori del mercato e residenti locali/, 'la descrizione su DB non entra se l\'autore ne ha scritta un\'altra');
  });

  it('senza testo nel form si usa quello su DB', async () => {
    const d = deps({ description: GOOD });
    await suggestDescription('id', {}, d);
    assert.match(d.requests[0]!.user, /TESTO DELL'AUTORE[^\n]*Una taverna popolare frequentata/);
  });

  it('le parole-chiave del testo dell\'autore devono restare: una stazione non diventa una cattedrale', () => {
    const base = 'La grande stazione ferroviaria in ferro e vetro, progettata da Brunel, brulicante di vapore e viaggiatori.';
    const wrong = 'L\'imponente cattedrale di ferro e vetro progettata da Brunel domina il paesaggio urbano con le sue strutture monumentali.';
    const r = missingContent(wrong, base);
    assert.ok(r.missing.includes('stazione'), r.missing.join(','));
    assert.ok(r.keptRatio < 0.6);
    const check = validateDescription(wrong, { knownText: base, canonYear: 1895, currentDescription: base }).checks.find((c) => c.code === 'lost-facts')!;
    assert.equal(check.ok, false);
    assert.match(check.detail!, /stazione/);

    const good = 'Una grande stazione ferroviaria in ferro e vetro, progettata da Brunel, dove il vapore avvolge i viaggiatori che brulicano tra i binari.';
    assert.equal(validateDescription(good, { knownText: base, canonYear: 1895, currentDescription: base }).checks.find((c) => c.code === 'lost-facts')!.ok, true);
  });

  it('con un testo troppo scarno per verificare (meno di 3 parole-chiave) il controllo non scatta', () => {
    assert.deepEqual(missingContent('Qualcosa di completamente diverso.', 'Una strada.'), { missing: [], keptRatio: 1 });
  });

  it('la lunghezza voluta cresce con il testo dell\'autore ma non supera mai il tetto', () => {
    assert.deepEqual(lengthTarget(40), { min: 135, max: 215 });
    assert.deepEqual(lengthTarget(80), { min: 135, max: 240 });
    const long = lengthTarget(500);
    assert.ok(long.max <= 400 && long.min <= 320);
  });
});


describe('suggestPositions', () => {
  const gen = (json: unknown) => {
    const requests: { system: string; user: string }[] = [];
    return { requests, generate: async (r: { system: string; user: string }) => { requests.push(r); return { json, ms: 10 }; } };
  };

  it('senza descrizione né tag non c\'è da dove ricavarle: 422 e il modello non viene chiamato', async () => {
    const g = gen({ positions: [] });
    await assert.rejects(() => suggestPositions({ name: 'The George Inn' }, g), InsufficientInputError);
    await assert.rejects(() => suggestPositions({ name: 'The George Inn', description: 'Una locanda.' }, g), InsufficientInputError);
    assert.equal(g.requests.length, 0);
  });

  it('con un tag basta: restituisce al massimo 3 posizioni, senza ingresso/uscita né doppioni né quelle già presenti', async () => {
    const g = gen({ positions: [
      { name: 'Ingresso', description: 'Dove si entra.' },
      { name: 'Angolo del camino', description: 'Un angolo riparato per parlare a bassa voce.' },
      { name: 'angolo del camino', description: 'Doppione.' },
      { name: 'Tavolo lungo', description: 'Un tavolo per i gruppi numerosi.' },
      { name: 'Corridoio', description: 'Già presente.' },
      { name: 'Panca sotto la finestra', description: 'Per aspettare con calma.' },
      { name: 'Quarta', description: 'Oltre il massimo.' },
    ] });
    const r = await suggestPositions({ name: 'The George Inn', tags: ['taverna'], existing: ['Corridoio'] }, g);
    assert.deepEqual(r.positions.map((p) => p.name), ['Angolo del camino', 'Tavolo lungo', 'Panca sotto la finestra']);
    assert.equal(r.ok, true);
    assert.match(g.requests[0]!.user, /GIÀ presenti.*Corridoio/);
    assert.doesNotMatch(g.requests[0]!.system, /Bancone|Tavolo 2/);
  });

  it('la nota «Per l\'AI:» non entra nel prompt come descrizione', async () => {
    const g = gen({ positions: [{ name: 'Panca', description: 'Per aspettare.' }] });
    await suggestPositions({ name: 'Una stazione', description: 'Una grande stazione ferroviaria con molti binari. Per l\'AI: aggiungi posti interessanti.' }, g);
    assert.doesNotMatch(g.requests[0]!.user, /aggiungi posti/);
  });

  it('segnala anacronismi, meteo e nomi propri inventati nel testo delle posizioni', async () => {
    const r = await suggestPositions({ name: 'Locanda', tags: ['taverna'] }, gen({ positions: [
      { name: 'Tavolo vicino al computer', description: 'Sotto la nebbia che entra, siede il signor Hobbs.' },
    ] }));
    assert.equal(r.ok, false);
    const failed = r.checks.filter((c) => !c.ok).map((c) => c.code);
    assert.ok(failed.includes('anachronism'));
    assert.ok(failed.includes('variable-conditions'));
    const mat = await suggestPositions({ name: 'Mercato', tags: ['mercato'] }, gen({ positions: [{ name: 'Banco', description: 'Un bancone di pietra per esporre la merce.' }] }));
    assert.ok(mat.checks.some((c) => c.code === 'invented-material' && !c.ok));
  });

  it('forma sbagliata dal modello = errore 502', async () => {
    await assert.rejects(() => suggestPositions({ name: 'X', tags: ['taverna'] }, gen({ positions: 'no' })), AiGatewayError);
  });

  it('cleanPositions mette la maiuscola iniziale', () => {
    assert.equal(cleanPositions([{ name: 'navata centrale', description: 'Per camminare.' }], [])[0]!.name, 'Navata centrale');
  });

  it('cleanPositions scarta nomi troppo lunghi e voci senza descrizione', () => {
    assert.deepEqual(cleanPositions([{ name: 'x'.repeat(31), description: 'a' }, { name: 'Ok', description: '' }, null, 5], []), []);
  });
});
