import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testBot } from './fixtures';
import { buildMessages, sanitizeReply, MAX_REPLY_CHARS } from '../prompt';

const bot = testBot({ targetWords: 40 });

test('il prompt contiene persona, lunghezza e trascrizione in ordine', () => {
  const [system, user] = buildMessages(bot, [
    { characterId: 'p1', characterName: 'John', content: 'Buonasera' },
    { characterId: 'p2', characterName: 'Mary', content: '*siede*' },
  ]);
  assert.match(system!.content, /locandiera/);
  assert.match(system!.content, /AL MASSIMO 40 parole/);
  assert.ok(user!.content.indexOf('John: Buonasera') < user!.content.indexOf('Mary: *siede*'));
});

test('sanitize toglie blocchi think, prefisso col nome e a capo', () => {
  const out = sanitizeReply('<think>ragiono\nancora</think>\nMrs. Hargreave: *alza lo sguardo*\nBuonasera.', 'Mrs. Hargreave');
  assert.equal(out, '*alza lo sguardo* Buonasera.');
});

test('sanitize non taglia mai a metà frase quando eccede il limite', () => {
  const sentence = 'Una frase completa e abbastanza lunga da riempire. ';
  const long = sentence.repeat(Math.ceil(MAX_REPLY_CHARS / sentence.length) + 5);
  const out = sanitizeReply(long, 'X');
  assert.ok(out.length <= MAX_REPLY_CHARS);
  assert.ok(out.endsWith('.'));
});

test('sanitize lascia intatta una risposta normale', () => {
  assert.equal(sanitizeReply('Ciao.', 'X'), 'Ciao.');
});

test('chi parla dall\'ingresso viene invitato a entrare', () => {
  const [, user] = buildMessages(bot, [
    { characterId: 'p1', characterName: 'John', content: 'Posso prendere da bere?', position: 'Ingresso', positionDescription: 'Punto d\'ingresso alla location' },
  ]);
  assert.match(user!.content, /John \[Ingresso\]: Posso prendere da bere\?/);
  assert.match(user!.content, /si trova in: Ingresso/);
  assert.match(user!.content, /invitalo a entrare e ad accomodarsi/);
});

test('senza posizione non c\'è il blocco situazione', () => {
  const [, user] = buildMessages(bot, [{ characterId: 'p1', characterName: 'John', content: 'Ciao' }]);
  assert.doesNotMatch(user!.content, /\[Situazione\]/);
});

test('sanitize toglie le virgolette: le parole dette non le usano', () => {
  assert.equal(sanitizeReply('*Alza lo sguardo.* \"Entra pure\", dice.', 'X'), '*Alza lo sguardo.* Entra pure, dice.');
});
