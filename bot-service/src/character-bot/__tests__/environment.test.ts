import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mentionsWeather, weatherLines, type BotEnvironment } from '../environment';
import { findIssues } from '../quality';

const rain: BotEnvironment = { condition: 'rain', description: 'piove', feel: 'fa freddo', words: ['piove', 'pioggia', 'pioggerella'] };

test('senza meteo dal backend il bot non lo indovina: se glielo chiedono ammette di non saperlo', () => {
  assert.deepEqual(weatherLines(null, { lastPlayerText: 'Un gin.', ownLines: [] }), []);
  assert.match(weatherLines(null, { lastPlayerText: 'Piove?', ownLines: [] }).join(' '), /Non sai che tempo faccia/);
});

test('un saluto in sala non porta il meteo; all\'ingresso sì, ma una volta sola', () => {
  assert.deepEqual(weatherLines(rain, { lastPlayerText: 'Un gin.', position: 'Bancone', ownLines: [] }), []);
  const door = weatherLines(rain, { lastPlayerText: 'Buonasera.', position: 'Ingresso', ownLines: [] });
  assert.match(door.join(' '), /piove e fa freddo/);
  assert.match(door.join(' '), /solo se viene naturale/);
  assert.deepEqual(weatherLines(rain, { lastPlayerText: 'Buonasera.', position: 'Ingresso', ownLines: ['Dentro, che piove.'] }), [], 'l\'ha già detto');
});

test('se lo chiedono si risponde sempre, anche se il bot ne aveva già parlato', () => {
  const lines = weatherLines(rain, { lastPlayerText: 'Piove ancora?', position: 'Bancone', ownLines: ['Fuori piove.'] });
  assert.match(lines.join(' '), /rispondi con questo/);
  assert.ok(weatherLines(rain, { lastPlayerText: 'Che freddo!', ownLines: [] }).length > 0);
});

test('il testo vieta altri fenomeni e non contiene numeri', () => {
  const text = weatherLines(rain, { lastPlayerText: 'Piove?', ownLines: [] }).join(' ');
  assert.match(text, /niente neve/);
  assert.doesNotMatch(text, /\d/);
});

test('con la pioggia in sidebar, «nevica» resta inventata ma «piove» no', () => {
  const known = `Buonasera ${rain.words.join(' ')}`;
  assert.deepEqual(findIssues('Fuori piove, entra.', [], known), []);
  assert.deepEqual(findIssues('Fuori nevica, entra.', [], known), [{ type: 'invented', names: ['nevica'] }]);
  assert.ok(mentionsWeather('Che pioggia!', rain));
});
