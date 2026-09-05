/**
 * Unit test per formulaEvaluator — il parser che ha sostituito eval() nelle
 * formule di stat (typescript:S1523).
 *
 * NB: al momento il repo non ha un test runner configurato (nessuno script
 * `test`, niente jest/vitest). Questo file segue lo stile di socialClass.test.ts
 * ed è pronto per quando il runner verrà aggiunto. La verifica manuale è stata
 * fatta confrontando l'output con `eval` su una batteria di formule.
 */

import { evaluateFormula, FormulaError } from '../formulaEvaluator';

describe('evaluateFormula', () => {
  describe('aritmetica', () => {
    it('applica la precedenza degli operatori', () => {
      expect(evaluateFormula('50 * 4 - 100 / 2')).toBe(150);
      expect(evaluateFormula('2 * (3 + 4)')).toBe(14);
    });

    it('gestisce unari e decimali', () => {
      expect(evaluateFormula('-5 + 3')).toBe(-2);
      expect(evaluateFormula('10 / 4')).toBe(2.5);
    });
  });

  describe('funzioni', () => {
    it('floor/ceil/round/abs a un argomento', () => {
      expect(evaluateFormula('floor((50 + 50) / 10)')).toBe(10);
      expect(evaluateFormula('ceil(2.1)')).toBe(3);
      expect(evaluateFormula('floor(abs(0 - 3.5))')).toBe(3);
    });

    it('min/max variadiche', () => {
      expect(evaluateFormula('min(50, 99)')).toBe(50);
      expect(evaluateFormula('max(1, 2, 3)')).toBe(3);
    });
  });

  describe('input non validi → FormulaError', () => {
    for (const bad of ['power', '1 + ', 'floor()', '', '2 ** 3', 'process', '1;2', 'a.b', '(1', '1)']) {
      it(`rifiuta ${JSON.stringify(bad)}`, () => {
        expect(() => evaluateFormula(bad)).toThrow(FormulaError);
      });
    }
  });
});
