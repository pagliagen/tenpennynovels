/**
 * Il flag ENABLE_IA_EDITORIAL è fail-closed: solo 'true' accende.
 *
 *   cd services/unified-backend
 *   npx tsx --test src/features/editorial/__tests__/envFlag.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isEnvFlagOn } from '../../../core/features/envFlag';

describe('isEnvFlagOn', () => {
  it('accende solo con il valore esatto "true"', () => {
    assert.equal(isEnvFlagOn('ENABLE_IA_EDITORIAL', { ENABLE_IA_EDITORIAL: 'true' }), true);
  });

  it('assente, vuoto o scritto in altro modo = spento (produzione per svista)', () => {
    for (const value of [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ']) {
      assert.equal(isEnvFlagOn('ENABLE_IA_EDITORIAL', { ENABLE_IA_EDITORIAL: value }), false, JSON.stringify(value));
    }
    assert.equal(isEnvFlagOn('ENABLE_IA_EDITORIAL', {}), false);
  });
});
