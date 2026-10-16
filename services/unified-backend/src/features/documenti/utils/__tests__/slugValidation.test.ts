import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSlug, MAX_SLUG_LENGTH } from '../slugValidation';

describe('validateSlug', () => {

  for (const slug of ['faq', 'epoca-vittoriana', 'la-citta', 'strato-1', '1885']) {
    it(`accetta "${slug}"`, () => assert.equal(validateSlug(slug), null));
  }

  for (const [slug, motivo] of [
    ['', 'vuoto'],
    ['Epoca-Vittoriana', 'maiuscole'],
    ['epoca vittoriana', 'spazi'],
    ['epoca--vittoriana', 'trattini doppi'],
    ['-epoca', 'trattino iniziale'],
    ['epoca-', 'trattino finale'],
    ['la-città', 'accenti'],
    ['epoca/vittoriana', 'slash (sarebbe un path annidato)'],
    ['a'.repeat(MAX_SLUG_LENGTH + 1), 'troppo lungo'],
  ] as const) {
    it(`rifiuta ${motivo}`, () => assert.notEqual(validateSlug(slug), null));
  }

  it('rifiuta valori non stringa (operatori Mongo, CWE-943)', () => {
    assert.notEqual(validateSlug({ $ne: 'x' }), null);
    assert.notEqual(validateSlug(undefined), null);
    assert.notEqual(validateSlug(42), null);
  });
});
