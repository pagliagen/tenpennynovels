/**
 * Character Skill Service
 *
 * Centralizes skill/stat value extraction from character documents.
 * Eliminates the 4+ duplications of this logic in ChatController.
 *
 * @module services/CharacterSkillService
 * @since 2.1.0
 */

import { logger } from '../logger';

/**
 * Character Skill Service
 */
export class CharacterSkillService {
  /**
   * Extract numeric skill value from character
   * Handles both number and SkillBreakdown object formats
   *
   * @param character - Character document from DB
   * @param skillId - Skill ObjectId as string
   * @returns Skill value (number) or null if not found
   */
  getSkillValue(character: any, skillId: string): number | null {
    const skillData = character.skills?.[skillId];

    if (skillData === undefined) {
      return null;
    }

    // Handle number format
    if (typeof skillData === 'number') {
      return skillData;
    }

    // Handle SkillBreakdown object format
    if (skillData && typeof skillData === 'object' && 'total' in skillData) {
      return (skillData as { total: number }).total;
    }

    return null;
  }

  /**
   * Extract numeric stat value from character
   *
   * @param character - Character document from DB
   * @param statName - Stat name (e.g., "forza", "destrezza", "costituzione")
   * @returns Stat value (number) or null if not found
   */
  getStatValue(character: any, statName: string): number | null {
    const statValue = character.stats?.[statName];

    if (statValue === undefined) {
      return null;
    }

    if (typeof statValue === 'number') {
      return statValue;
    }

    return null;
  }

  /**
   * Get skill value with default fallback
   * Returns defaultValue if skill not found (useful for optional skills)
   *
   * @param character - Character document
   * @param skillId - Skill ID
   * @param defaultValue - Default value if not found (default: 1)
   * @returns Skill value or default
   */
  getSkillValueOrDefault(character: any, skillId: string, defaultValue: number = 1): number {
    const value = this.getSkillValue(character, skillId);
    if (value === null || value === 0) {
      logger.warn(
        `[CharacterSkillService] Skill ${skillId} not found or is 0 for character ${character._id}, using default ${defaultValue}`
      );
      return defaultValue;
    }
    return value;
  }

  /**
   * Validate character has skill (value > 0)
   *
   * @param character - Character document
   * @param skillId - Skill ID
   * @returns True if character has skill with value > 0
   */
  hasSkill(character: any, skillId: string): boolean {
    const value = this.getSkillValue(character, skillId);
    return value !== null && value > 0;
  }

  /**
   * Validate character has stat
   *
   * @param character - Character document
   * @param statName - Stat name
   * @returns True if character has stat with value > 0
   */
  hasStat(character: any, statName: string): boolean {
    const value = this.getStatValue(character, statName);
    return value !== null && value > 0;
  }

  /**
   * Extract numeric value from skill data (private helper)
   */
  private extractNumericValue(skillData: any): number | null {
    if (typeof skillData === 'number') {
      return skillData;
    }
    if (skillData && typeof skillData === 'object' && 'total' in skillData) {
      return (skillData as { total: number }).total;
    }
    return null;
  }
}
