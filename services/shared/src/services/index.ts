/**
 * Shared Services Index
 *
 * Exports all shared services used across the TenpennyNovels platform.
 */

export { AnalyticsService } from './AnalyticsService';
export { GeoLocationService } from './GeoLocationService';
export { ConfigurationService } from './ConfigurationService';
export {
  CharacterCreationConfigService,
  getCharacterCreationConfig,
  calculateIntelligenceBonus,
  validateIntelligenceBonusFormula,
  getIntelligenceBonusFormula,
  calculateDerivedStat,
  validateDerivedFormula,
  calculateDamageBonusTable,
  calculateAllDerivedStats
} from './CharacterCreationConfigService';
export type {
  CharacterCreationConfig,
  CharacterStats,
  DerivedStats,
  DamageBonusEntry
} from './CharacterCreationConfigService';
