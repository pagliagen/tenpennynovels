/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/documenti/utils/__tests__/documentOrder.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nextSiblingOrder } from '../documentOrder';

describe('nextSiblingOrder', () => {
  it('va dopo l\'ultimo fratello', () => {
    assert.equal(nextSiblingOrder(4), 5);
  });

  it('con fratelli tutti a 0 (documenti vecchi) va comunque dopo di loro', () => {
    assert.equal(nextSiblingOrder(0), 1);
  });

  it('senza fratelli parte da 1, come il riordino', () => {
    assert.equal(nextSiblingOrder(undefined), 1);
    assert.equal(nextSiblingOrder(null), 1);
  });
});
