import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRequest, knowledgeLines, knowledgeVocabulary, NO_REQUEST, validateInfoRequest, type BotKnowledge } from '../knowledge';

const TAGS = ['alloggio', 'parco', 'taverna'];

const place = (over: Partial<BotKnowledge['places'][number]>): BotKnowledge['places'][number] => ({
  name: 'Ratcliff Highway', district: 'East End', quartiere: 'Stepney', description: 'Una strada malfamata piena di bettole e pensioni.',
  tags: ['alloggio'], proximity: 'near', isCurrent: false, ...over,
});
const lore = (covered: boolean): BotKnowledge['lore'] => ({
  covered,
  passages: covered ? [{ title: 'Folklore', heading: "Le creature dell'acqua", text: 'Si dice che nel Tamigi vivano creature che trascinano giù i ubriachi.', score: 0.6 }] : [],
});

test('l\'analisi propone, il codice verifica: tag fuori elenco scartati, nome luogo solo se nel testo', () => {
  const text = 'Conosci il Mayflower Inn? Cerco un posto per dormire.';
  const r = validateInfoRequest({ tags: ['alloggio', 'castello', 5], placeName: 'Mayflower Inn', needsLore: true }, TAGS, text);
  assert.deepEqual(r, { tags: ['alloggio'], placeName: 'Mayflower Inn', needsLore: true });
  assert.equal(validateInfoRequest({ tags: [], placeName: 'Blue Boar', needsLore: false }, TAGS, text).placeName, null, 'nome allucinato');
  assert.deepEqual(validateInfoRequest(undefined, TAGS, text), NO_REQUEST);
  assert.equal(hasRequest(NO_REQUEST), false);
});

test('nessuna richiesta = nessun blocco; backend muto = ammette di non sapere', () => {
  assert.deepEqual(knowledgeLines(NO_REQUEST, null), []);
  const lines = knowledgeLines({ tags: ['alloggio'], placeName: null, needsLore: false }, null).join(' ');
  assert.match(lines, /Non riesci a ricordare/);
});

test('luoghi: vicino con descrizione, lontano senza (solo ne ha sentito parlare), nessuno = non conosce niente', () => {
  const req = { tags: ['alloggio'], placeName: null, needsLore: false };
  const text = knowledgeLines(req, {
    places: [place({}), place({ name: "Claridge's Hotel", district: 'West End', quartiere: 'Mayfair', description: 'Il miglior hotel di Londra.', proximity: 'far' })],
    lore: lore(false),
  }).join('\n');
  assert.match(text, /Ratcliff Highway \(Stepney, East End\), nel tuo distretto.*malfamata/);
  assert.match(text, /Claridge's Hotel \(Mayfair, West End\): dall'altra parte della città/);
  assert.doesNotMatch(text, /miglior hotel/, 'di ciò che è lontano non si sa com\'è fatto');
  assert.match(text, /Nomina SOLO i luoghi elencati/);

  assert.match(knowledgeLines(req, { places: [], lore: lore(false) }).join(' '), /Non conosci nessun posto/);
});

test('il luogo in cui si trova il bot è «questo stesso locale»', () => {
  const text = knowledgeLines({ tags: ['taverna'], placeName: null, needsLore: false }, {
    places: [place({ name: 'Ten Bells Public House', isCurrent: true, proximity: 'here', description: 'Una taverna popolare.' })], lore: lore(false),
  }).join('\n');
  assert.match(text, /Ten Bells Public House: è questo stesso locale/);
});

test('lore: coperta = passaggi da riportare a modo suo; non coperta = dice che non sa', () => {
  const req = { tags: [], placeName: null, needsLore: true };
  assert.match(knowledgeLines(req, { places: [], lore: lore(true) }).join('\n'), /creature che trascinano.*senza citare documenti/s);
  assert.match(knowledgeLines(req, { places: [], lore: lore(false) }).join(' '), /non sai niente di preciso/);
  assert.doesNotMatch(knowledgeLines(req, { places: [], lore: lore(true) }).join(' '), /Non conosci nessun posto/, 'una domanda di lore non parla di luoghi');
});

test('il vocabolario autorizzato contiene luoghi, quartieri e distretti mostrati', () => {
  assert.deepEqual(knowledgeVocabulary({ places: [place({})], lore: lore(false) }), ['Ratcliff Highway', 'East End', 'Stepney']);
  assert.deepEqual(knowledgeVocabulary(null), []);
});
