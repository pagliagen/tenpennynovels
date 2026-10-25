/**
 *   cd services/unified-backend
 *   npx tsx --test src/core/location/constants/__tests__/locationTags.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isLocationTag, locationTagList, sanitizeLocationTags, LOCATION_TAGS } from '../locationTags';

describe('sanitizeLocationTags', () => {
  it('normalizza maiuscole, spazi e doppioni', () => {
    assert.deepEqual(sanitizeLocationTags([' Alloggio ', 'alloggio', 'PARCO']), { tags: ['alloggio', 'parco'], invalid: [] });
  });

  it('segnala i tag fuori elenco e non li accetta', () => {
    assert.deepEqual(sanitizeLocationTags(['parco', 'castello', 42]), { tags: ['parco'], invalid: ['castello', '42'] });
  });

  it('input che non è una lista = nessun tag', () => {
    assert.deepEqual(sanitizeLocationTags(undefined), { tags: [], invalid: [] });
    assert.deepEqual(sanitizeLocationTags('parco'), { tags: [], invalid: [] });
  });

  it('isLocationTag non si fa ingannare dalle proprietà di Object', () => {
    assert.equal(isLocationTag('toString'), false);
    assert.equal(isLocationTag('constructor'), false);
  });

  it('ogni tag ha etichetta e hint', () => {
    for (const entry of locationTagList()) {
      assert.ok(entry.label.length > 0 && entry.hint.length > 10, entry.tag);
    }
    assert.equal(locationTagList().length, LOCATION_TAGS.length);
  });
});
