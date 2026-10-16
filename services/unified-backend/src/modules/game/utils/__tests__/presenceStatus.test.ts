import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PRESENCE_REASON_LENGTH, parsePresenceStatus } from '../presenceStatus';

test('accetta stato valido e normalizza la motivazione', () => {
  const r = parsePresenceStatus({ availableToPlay: false, reason: '  fuori   per cena \n ' });
  assert.deepEqual(r, { ok: true, value: { availableToPlay: false, reason: 'fuori per cena' } });
});

test('motivazione assente = stringa vuota', () => {
  assert.deepEqual(parsePresenceStatus({ availableToPlay: true }), {
    ok: true,
    value: { availableToPlay: true, reason: '' }
  });
});

test('availableToPlay deve essere un booleano vero (niente "true", 1, oggetti)', () => {
  for (const bad of ['true', 1, null, undefined, { $ne: false }]) {
    assert.equal(parsePresenceStatus({ availableToPlay: bad, reason: '' }).ok, false);
  }
});

test('la motivazione deve essere una stringa (niente oggetti/array)', () => {
  assert.equal(parsePresenceStatus({ availableToPlay: true, reason: { $gt: '' } }).ok, false);
  assert.equal(parsePresenceStatus({ availableToPlay: true, reason: ['a'] }).ok, false);
  assert.equal(parsePresenceStatus({ availableToPlay: true, reason: 5 }).ok, false);
});

test('limite di lunghezza dopo la normalizzazione', () => {
  const ok = 'a'.repeat(MAX_PRESENCE_REASON_LENGTH);
  assert.equal(parsePresenceStatus({ availableToPlay: true, reason: ok }).ok, true);
  assert.equal(parsePresenceStatus({ availableToPlay: true, reason: ok + 'b' }).ok, false);
  // spazi multipli contano come uno solo
  assert.equal(
    parsePresenceStatus({ availableToPlay: true, reason: 'a' + ' '.repeat(200) + 'b' }).ok,
    true
  );
});

test('rimuove i caratteri di controllo', () => {
  const r = parsePresenceStatus({ availableToPlay: true, reason: 'a\u0000b\u202Ec' });
  assert.equal(r.ok && r.value.reason, 'a b c');
});

test('body non oggetto', () => {
  for (const bad of [null, undefined, 'x', 3]) assert.equal(parsePresenceStatus(bad).ok, false);
});
