/**
 * Unit Tests for Social Class System
 *
 * Tests the SocialClassHelper utility class and related functionality
 * for the 8-value granular social class system.
 */

import {
  SocialClass,
  SocialClassHelper,
  SocialClassInfo,
  SOCIAL_CLASS_LABELS,
  ALL_SOCIAL_CLASSES
} from '../socialClass';

describe('SocialClassHelper', () => {
  describe('fromFinanza', () => {
    it('should map FINANZA values to correct social classes', () => {
      // Destitute: 1-9
      expect(SocialClassHelper.fromFinanza(1)).toBe('destitute');
      expect(SocialClassHelper.fromFinanza(5)).toBe('destitute');
      expect(SocialClassHelper.fromFinanza(9)).toBe('destitute');

      // Poor: 10-19
      expect(SocialClassHelper.fromFinanza(10)).toBe('poor');
      expect(SocialClassHelper.fromFinanza(15)).toBe('poor');
      expect(SocialClassHelper.fromFinanza(19)).toBe('poor');

      // Modest: 20-39
      expect(SocialClassHelper.fromFinanza(20)).toBe('modest');
      expect(SocialClassHelper.fromFinanza(25)).toBe('modest');
      expect(SocialClassHelper.fromFinanza(39)).toBe('modest');

      // Lower Middle: 40-49
      expect(SocialClassHelper.fromFinanza(40)).toBe('lower_middle');
      expect(SocialClassHelper.fromFinanza(45)).toBe('lower_middle');
      expect(SocialClassHelper.fromFinanza(49)).toBe('lower_middle');

      // Middle Class: 50-69
      expect(SocialClassHelper.fromFinanza(50)).toBe('middle_class');
      expect(SocialClassHelper.fromFinanza(60)).toBe('middle_class');
      expect(SocialClassHelper.fromFinanza(69)).toBe('middle_class');

      // Wealthy: 70-79
      expect(SocialClassHelper.fromFinanza(70)).toBe('wealthy');
      expect(SocialClassHelper.fromFinanza(75)).toBe('wealthy');
      expect(SocialClassHelper.fromFinanza(79)).toBe('wealthy');

      // Affluent: 80-89
      expect(SocialClassHelper.fromFinanza(80)).toBe('affluent');
      expect(SocialClassHelper.fromFinanza(85)).toBe('affluent');
      expect(SocialClassHelper.fromFinanza(89)).toBe('affluent');

      // Elite: 90-99
      expect(SocialClassHelper.fromFinanza(90)).toBe('elite');
      expect(SocialClassHelper.fromFinanza(95)).toBe('elite');
      expect(SocialClassHelper.fromFinanza(99)).toBe('elite');
    });

    it('should handle edge cases and out-of-range values', () => {
      expect(SocialClassHelper.fromFinanza(0)).toBe('destitute');
      expect(SocialClassHelper.fromFinanza(-5)).toBe('destitute');
      expect(SocialClassHelper.fromFinanza(100)).toBe('elite');
      expect(SocialClassHelper.fromFinanza(150)).toBe('elite');
    });
  });

  describe('getLabel', () => {
    it('should return correct Italian labels', () => {
      expect(SocialClassHelper.getLabel('destitute')).toBe('Indigente');
      expect(SocialClassHelper.getLabel('poor')).toBe('Povero');
      expect(SocialClassHelper.getLabel('modest')).toBe('Modesto');
      expect(SocialClassHelper.getLabel('lower_middle')).toBe('Piccola borghesia');
      expect(SocialClassHelper.getLabel('middle_class')).toBe('Media borghesia');
      expect(SocialClassHelper.getLabel('wealthy')).toBe('Ricco');
      expect(SocialClassHelper.getLabel('affluent')).toBe('Facoltoso');
      expect(SocialClassHelper.getLabel('elite')).toBe('Élite');
    });
  });

  describe('getInfo', () => {
    it('should return complete social class information', () => {
      const info: SocialClassInfo = SocialClassHelper.getInfo('middle_class');

      expect(info.id).toBe('middle_class');
      expect(info.label).toBe('Media borghesia');
      expect(info.financeRange).toEqual({ min: 50, max: 69 });
      expect(info.weeklyCredit).toBe(75);
      expect(info.initialWealth).toEqual({ min: 400, max: 800 });
    });

    it('should return correct info for all social classes', () => {
      ALL_SOCIAL_CLASSES.forEach(socialClass => {
        const info = SocialClassHelper.getInfo(socialClass);

        expect(info.id).toBe(socialClass);
        expect(info.label).toBe(SOCIAL_CLASS_LABELS[socialClass]);
        expect(info.financeRange.min).toBeGreaterThan(0);
        expect(info.financeRange.max).toBeLessThanOrEqual(99);
        expect(info.weeklyCredit).toBeGreaterThan(0);
        expect(info.initialWealth.min).toBeGreaterThan(0);
        expect(info.initialWealth.max).toBeGreaterThan(info.initialWealth.min);
      });
    });
  });

  describe('hasAristocracyBadge', () => {
    it('should return true for elite with nobility occupation', () => {
      const character = {
        socialClass: 'elite' as SocialClass,
        occupation: { category: 'nobility' }
      };
      expect(SocialClassHelper.hasAristocracyBadge(character)).toBe(true);
    });

    it('should return true for elite with nobility in background', () => {
      const characterWithNobil = {
        socialClass: 'elite' as SocialClass,
        background: { briefHistory: 'Nato da famiglia nobile di Londra' }
      };
      expect(SocialClassHelper.hasAristocracyBadge(characterWithNobil)).toBe(true);

      const characterWithAristocra = {
        socialClass: 'elite' as SocialClass,
        background: { briefHistory: 'Discende da antica famiglia aristocratica' }
      };
      expect(SocialClassHelper.hasAristocracyBadge(characterWithAristocra)).toBe(true);
    });

    it('should return false for non-elite classes even with nobility occupation', () => {
      const character = {
        socialClass: 'wealthy' as SocialClass,
        occupation: { category: 'nobility' }
      };
      expect(SocialClassHelper.hasAristocracyBadge(character)).toBe(false);
    });

    it('should return false for elite without nobility markers', () => {
      const character = {
        socialClass: 'elite' as SocialClass,
        occupation: { category: 'business' },
        background: { briefHistory: 'Self-made businessman from humble origins' }
      };
      expect(SocialClassHelper.hasAristocracyBadge(character)).toBe(false);
    });

    it('should handle missing occupation and background gracefully', () => {
      const character = {
        socialClass: 'elite' as SocialClass
      };
      expect(SocialClassHelper.hasAristocracyBadge(character)).toBe(false);
    });
  });

  describe('getColor', () => {
    it('should return purple for aristocracy badge', () => {
      expect(SocialClassHelper.getColor('elite', true)).toBe('#8b5cf6');
      expect(SocialClassHelper.getColor('destitute', true)).toBe('#8b5cf6');
    });

    it('should return gradient colors for social classes without aristocracy', () => {
      expect(SocialClassHelper.getColor('destitute')).toBe('#ef4444'); // Red
      expect(SocialClassHelper.getColor('poor')).toBe('#f97316'); // Orange-red
      expect(SocialClassHelper.getColor('modest')).toBe('#f59e0b'); // Orange
      expect(SocialClassHelper.getColor('lower_middle')).toBe('#eab308'); // Yellow
      expect(SocialClassHelper.getColor('middle_class')).toBe('#84cc16'); // Yellow-green
      expect(SocialClassHelper.getColor('wealthy')).toBe('#22c55e'); // Green
      expect(SocialClassHelper.getColor('affluent')).toBe('#10b981'); // Teal
      expect(SocialClassHelper.getColor('elite')).toBe('#06b6d4'); // Cyan
    });

    it('should return all valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      ALL_SOCIAL_CLASSES.forEach(socialClass => {
        const color = SocialClassHelper.getColor(socialClass);
        expect(color).toMatch(hexColorRegex);
      });

      // Test aristocracy color
      expect(SocialClassHelper.getColor('elite', true)).toMatch(hexColorRegex);
    });
  });

  describe('isValid', () => {
    it('should return true for valid social classes', () => {
      expect(SocialClassHelper.isValid('destitute')).toBe(true);
      expect(SocialClassHelper.isValid('poor')).toBe(true);
      expect(SocialClassHelper.isValid('modest')).toBe(true);
      expect(SocialClassHelper.isValid('lower_middle')).toBe(true);
      expect(SocialClassHelper.isValid('middle_class')).toBe(true);
      expect(SocialClassHelper.isValid('wealthy')).toBe(true);
      expect(SocialClassHelper.isValid('affluent')).toBe(true);
      expect(SocialClassHelper.isValid('elite')).toBe(true);
    });

    it('should return false for invalid social classes', () => {
      expect(SocialClassHelper.isValid('working')).toBe(false);
      expect(SocialClassHelper.isValid('middle')).toBe(false);
      expect(SocialClassHelper.isValid('upper')).toBe(false);
      expect(SocialClassHelper.isValid('aristocracy')).toBe(false);
      expect(SocialClassHelper.isValid('invalid')).toBe(false);
      expect(SocialClassHelper.isValid('')).toBe(false);
    });
  });

  describe('getFinanzaRange', () => {
    it('should return correct FINANZA ranges', () => {
      expect(SocialClassHelper.getFinanzaRange('destitute')).toEqual({ min: 1, max: 9 });
      expect(SocialClassHelper.getFinanzaRange('poor')).toEqual({ min: 10, max: 19 });
      expect(SocialClassHelper.getFinanzaRange('modest')).toEqual({ min: 20, max: 39 });
      expect(SocialClassHelper.getFinanzaRange('lower_middle')).toEqual({ min: 40, max: 49 });
      expect(SocialClassHelper.getFinanzaRange('middle_class')).toEqual({ min: 50, max: 69 });
      expect(SocialClassHelper.getFinanzaRange('wealthy')).toEqual({ min: 70, max: 79 });
      expect(SocialClassHelper.getFinanzaRange('affluent')).toEqual({ min: 80, max: 89 });
      expect(SocialClassHelper.getFinanzaRange('elite')).toEqual({ min: 90, max: 99 });
    });
  });

  describe('getWeeklyCredit', () => {
    it('should return correct weekly credit amounts', () => {
      expect(SocialClassHelper.getWeeklyCredit('destitute')).toBe(2);
      expect(SocialClassHelper.getWeeklyCredit('poor')).toBe(5);
      expect(SocialClassHelper.getWeeklyCredit('modest')).toBe(15);
      expect(SocialClassHelper.getWeeklyCredit('lower_middle')).toBe(30);
      expect(SocialClassHelper.getWeeklyCredit('middle_class')).toBe(75);
      expect(SocialClassHelper.getWeeklyCredit('wealthy')).toBe(150);
      expect(SocialClassHelper.getWeeklyCredit('affluent')).toBe(300);
      expect(SocialClassHelper.getWeeklyCredit('elite')).toBe(500);
    });
  });

  describe('getInitialWealth', () => {
    it('should return correct initial wealth ranges', () => {
      expect(SocialClassHelper.getInitialWealth('destitute')).toEqual({ min: 5, max: 15 });
      expect(SocialClassHelper.getInitialWealth('poor')).toEqual({ min: 20, max: 40 });
      expect(SocialClassHelper.getInitialWealth('modest')).toEqual({ min: 50, max: 100 });
      expect(SocialClassHelper.getInitialWealth('lower_middle')).toEqual({ min: 150, max: 300 });
      expect(SocialClassHelper.getInitialWealth('middle_class')).toEqual({ min: 400, max: 800 });
      expect(SocialClassHelper.getInitialWealth('wealthy')).toEqual({ min: 1000, max: 2000 });
      expect(SocialClassHelper.getInitialWealth('affluent')).toEqual({ min: 3000, max: 5000 });
      expect(SocialClassHelper.getInitialWealth('elite')).toEqual({ min: 8000, max: 15000 });
    });
  });

  describe('Constants', () => {
    it('should have exactly 8 social classes', () => {
      expect(ALL_SOCIAL_CLASSES).toHaveLength(8);
    });

    it('should have labels for all social classes', () => {
      ALL_SOCIAL_CLASSES.forEach(socialClass => {
        expect(SOCIAL_CLASS_LABELS[socialClass]).toBeDefined();
        expect(SOCIAL_CLASS_LABELS[socialClass].length).toBeGreaterThan(0);
      });
    });

    it('should have unique social class IDs', () => {
      const uniqueClasses = new Set(ALL_SOCIAL_CLASSES);
      expect(uniqueClasses.size).toBe(ALL_SOCIAL_CLASSES.length);
    });
  });

  describe('Integration: FINANZA → SocialClass → Info', () => {
    it('should correctly map FINANZA value through entire flow', () => {
      const finanzaValues = [5, 15, 25, 45, 55, 75, 85, 95];

      finanzaValues.forEach(finanza => {
        // Step 1: Get social class from FINANZA
        const socialClass = SocialClassHelper.fromFinanza(finanza);

        // Step 2: Validate it's a valid class
        expect(SocialClassHelper.isValid(socialClass)).toBe(true);

        // Step 3: Get full info
        const info = SocialClassHelper.getInfo(socialClass);

        // Step 4: Verify FINANZA is within the class range
        expect(finanza).toBeGreaterThanOrEqual(info.financeRange.min);
        expect(finanza).toBeLessThanOrEqual(info.financeRange.max);

        // Step 5: Verify we can get color
        const color = SocialClassHelper.getColor(socialClass);
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);

        // Step 6: Verify we can get label
        const label = SocialClassHelper.getLabel(socialClass);
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });
});
