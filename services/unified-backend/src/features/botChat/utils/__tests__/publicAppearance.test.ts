/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/botChat/utils/__tests__/publicAppearance.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toPublicAppearance, type AppearanceSource } from '../publicAppearance';

describe('toPublicAppearance', () => {
  it('lascia passare solo i campi pubblici, mai quelli riservati ai master', () => {
    const source = {
      _id: { toString: () => 'abc' },
      gender: 'male',
      apparentAge: 22,
      physicalDescription: ' Alto, spalle larghe ',
      eyeColor: 'verdi',
      // Riservati: non fanno parte di AppearanceSource, ma una lean() li porta comunque.
      age: 47,
      birthDate: '1/1/1841',
      privateDescription: 'segreto',
      hiddenMarks: 'tatuaggio',
      userId: 'u1',
    } as AppearanceSource;

    const out = toPublicAppearance(source);
    assert.deepEqual(out, { _id: 'abc', gender: 'male', apparentAge: 22, physicalDescription: 'Alto, spalle larghe', eyeColor: 'verdi' });
    for (const secret of ['age', 'birthDate', 'privateDescription', 'hiddenMarks', 'userId']) {
      assert.equal(secret in out, false, secret);
    }
  });

  it('ignora valori vuoti o di tipo sbagliato', () => {
    const out = toPublicAppearance({
      _id: { toString: () => 'x' }, gender: null, apparentAge: Number.NaN, physicalDescription: '  ', hairColor: null,
    });
    assert.deepEqual(out, { _id: 'x' });
  });
});
