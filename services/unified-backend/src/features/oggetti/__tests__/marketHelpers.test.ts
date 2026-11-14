import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { occupationIn, toIdString } from '../utils/marketHelpers';

describe('marketHelpers', () => {
  const oid = { toString: () => '64b000000000000000000001' };

  it('confronta ObjectId e stringa', () => {
    assert.equal(occupationIn(['64b000000000000000000001'], oid), true);
    assert.equal(occupationIn([oid], '64b000000000000000000001'), true);
  });

  it('non combacia con un altro id o con un nome', () => {
    assert.equal(occupationIn(['64b000000000000000000002'], oid), false);
    assert.equal(occupationIn(['medico'], oid), false);
  });

  it('elenco vuoto, assente o occupazione mancante = false', () => {
    assert.equal(occupationIn([], oid), false);
    assert.equal(occupationIn(undefined, oid), false);
    assert.equal(occupationIn(['x'], undefined), false);
  });

  it('toIdString gestisce null e stringa vuota', () => {
    assert.equal(toIdString(null), null);
    assert.equal(toIdString(''), null);
  });
});
