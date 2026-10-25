/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/botChat/utils/__tests__/botEnvironment.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { feelsLike, toBotEnvironment } from '../botEnvironment';

describe('toBotEnvironment', () => {
  it('descrive ogni condizione del gioco con le sole parole di quel tempo', () => {
    const rain = toBotEnvironment({ condition: 'rain', temperature: 9 });
    assert.equal(rain.description, 'piove');
    assert.ok(rain.words.includes('pioggia'));
    assert.ok(!rain.words.includes('neve'), 'in sidebar c\'è la pioggia: la neve non esiste per il bot');
    assert.equal(toBotEnvironment({ condition: 'fog', temperature: 5 }).description, 'c\'è nebbia');
  });

  it('non espone il numero: solo come si sente', () => {
    assert.equal(feelsLike(1), 'fa un freddo gelido');
    assert.equal(feelsLike(5), 'fa freddo');
    assert.equal(feelsLike(12), 'fa fresco');
    assert.equal(feelsLike(18), 'il tempo è mite');
    assert.equal(feelsLike(25), 'fa caldo');
    assert.ok(!JSON.stringify(toBotEnvironment({ condition: 'clear', temperature: 17 })).includes('17'));
  });
});
