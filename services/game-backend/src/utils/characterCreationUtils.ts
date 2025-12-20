import { Character, Occupation, Skill } from '../../../../packages/database/models';
import { ICharacter } from '../../../../packages/database/models/Character';
import { IOccupation } from '../../../../packages/database/models/Occupation';
import { logger } from './logger';

/**
 * Character Creation Utilities
 *
 * Helper functions for the new character creation system based on Call of Cthulhu rules.
 * Implements the new occupation system with required skills (6) and bonus skills (1-2).
 */

interface SkillPointsCalculation {
  basePoints: number; // 200 punti base
  intBonus: number; // INT/2 bonus points
  totalAvailable: number; // Total points available for distribution
  occupationRequiredSkills: number; // Number of skills that must be improved (always 6)
  skillCap: number; // Maximum value per skill during creation (default 75)
  finalSkillCap: number; // Maximum value after occupation bonuses (default 80)
}

interface OccupationBonusResult {
  bonusesApplied: {
    skillId: string;
    skillName: string;
    bonusValue: number;
    finalValue: number;
  }[];
  exceededCap: boolean;
  warnings: string[];
}

interface CharacterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate available skill points for a character
 *
 * Formula: 200 base points + INT/2 bonus
 *
 * @param character - The character object
 * @returns Skill points calculation breakdown
 */
export function calculateAvailableSkillPoints(character: ICharacter): SkillPointsCalculation {
  const basePoints = 200;
  const intBonus = Math.floor((character.stats.intelligence || 0) / 2);
  const totalAvailable = basePoints + intBonus;

  // Environment variables for caps (from .env)
  const skillCap = parseInt(process.env.CHARACTER_SKILL_CAP || '75');
  const finalSkillCap = parseInt(process.env.CHARACTER_FINAL_SKILL_CAP || '80');

  logger.debug('Calculating skill points', {
    characterId: character.id,
    intelligence: character.stats.intelligence,
    basePoints,
    intBonus,
    totalAvailable
  });

  return {
    basePoints,
    intBonus,
    totalAvailable,
    occupationRequiredSkills: 6, // Always 6 required skills per occupation
    skillCap,
    finalSkillCap
  };
}

/**
 * Apply occupation bonuses to character skills
 *
 * The new system grants 1-2 automatic bonus skills that don't count against
 * the character's skill point budget. These bonuses can push skills above
 * the normal cap (75) up to the final cap (80).
 *
 * @param character - The character to apply bonuses to
 * @param occupation - The occupation with bonus skills
 * @param selectedAlternatives - Map of requirement ID to selected alternative skill ID (for choice skills)
 * @returns Result of bonus application with details
 */
export async function applyOccupationBonuses(
  character: ICharacter,
  occupation: IOccupation,
  selectedAlternatives?: { [requirementId: string]: string }
): Promise<OccupationBonusResult> {
  const result: OccupationBonusResult = {
    bonusesApplied: [],
    exceededCap: false,
    warnings: []
  };

  const finalSkillCap = parseInt(process.env.CHARACTER_FINAL_SKILL_CAP || '80');

  // Validate occupation has bonusSkills
  if (!occupation.bonusSkills || occupation.bonusSkills.length === 0) {
    result.warnings.push('Occupation has no bonus skills defined');
    return result;
  }

  logger.info('Applying occupation bonuses', {
    characterId: character.id,
    occupationId: occupation.id,
    occupationName: occupation.name,
    bonusSkillCount: occupation.bonusSkills.length
  });

  // Initialize skills map if it doesn't exist
  if (!character.skills) {
    character.skills = {};
  }

  // Apply each bonus skill
  for (const bonusSkill of occupation.bonusSkills) {
    try {
      // Fetch skill details
      const skill = await Skill.findById(bonusSkill.skillId);

      if (!skill) {
        result.warnings.push(`Bonus skill with ID ${bonusSkill.skillId} not found`);
        continue;
      }

      const skillName = skill.name;
      const currentValue = character.skills[skillName] || skill.baseValue || 0;
      const bonusValue = bonusSkill.bonusValue;
      const newValue = currentValue + bonusValue;

      // Check if bonus would exceed final cap
      if (newValue > finalSkillCap) {
        result.exceededCap = true;
        result.warnings.push(
          `Bonus for ${skillName} would exceed cap (${newValue} > ${finalSkillCap}). Capping at ${finalSkillCap}.`
        );
        character.skills[skillName] = finalSkillCap;
      } else {
        character.skills[skillName] = newValue;
      }

      result.bonusesApplied.push({
        skillId: skill.id,
        skillName,
        bonusValue,
        finalValue: character.skills[skillName]
      });

      logger.debug('Applied bonus skill', {
        characterId: character.id,
        skillName,
        currentValue,
        bonusValue,
        newValue: character.skills[skillName]
      });

    } catch (error: any) {
      logger.error('Error applying bonus skill', {
        error: error.message,
        bonusSkillId: bonusSkill.skillId
      });
      result.warnings.push(`Failed to apply bonus for skill ${bonusSkill.skillId}: ${error.message}`);
    }
  }

  // Mark that bonuses have been applied
  character.occupationBonusesApplied = true;

  // Store selected alternative skills if provided
  if (selectedAlternatives) {
    character.selectedAlternativeSkills = selectedAlternatives;
  }

  logger.info('Occupation bonuses applied', {
    characterId: character.id,
    appliedCount: result.bonusesApplied.length,
    exceededCap: result.exceededCap,
    warningCount: result.warnings.length
  });

  return result;
}

/**
 * Validate character for submission/approval
 *
 * Checks:
 * - All required fields are present
 * - Stats total is within allowed range (400 points + minimums)
 * - Skills total doesn't exceed available points
 * - All required skills for occupation have been improved
 * - No skill exceeds the cap
 * - Character has selected an occupation
 * - Background is complete
 *
 * @param character - The character to validate
 * @returns Validation result with errors and warnings
 */
export async function validateCharacterSubmission(character: ICharacter): Promise<CharacterValidationResult> {
  const result: CharacterValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  logger.info('Validating character for submission', {
    characterId: character.id,
    characterName: character.name,
    status: character.status
  });

  // ====== BASIC INFO VALIDATION ======
  if (!character.name || character.name.trim() === '' || character.name === 'New Character') {
    result.errors.push('Character name is required');
    result.isValid = false;
  }

  if (!character.age || character.age < 16 || character.age > 80) {
    result.errors.push('Character age must be between 16 and 80');
    result.isValid = false;
  }

  if (!character.apparentAge || character.apparentAge < 16 || character.apparentAge > 80) {
    result.errors.push('Character apparent age must be between 16 and 80');
    result.isValid = false;
  }

  if (!character.gender) {
    result.errors.push('Character gender is required');
    result.isValid = false;
  }

  if (!character.publicDescription || character.publicDescription.length < 50) {
    result.errors.push('Public description must be at least 50 characters');
    result.isValid = false;
  }

  if (!character.privateDescription || character.privateDescription.length < 50) {
    result.errors.push('Private description must be at least 50 characters');
    result.isValid = false;
  }

  // ====== STATS VALIDATION ======
  const statTotal = parseInt(process.env.CHARACTER_STAT_TOTAL_POINTS || '400');
  const maxStatsAbove80 = parseInt(process.env.CHARACTER_MAX_STATS_ABOVE_80 || '2');

  // Calculate minimum points from environment variables
  const minStats = {
    strength: parseInt(process.env.CHARACTER_MIN_STR || '20'),
    size: parseInt(process.env.CHARACTER_MIN_SIZ || '20'),
    dexterity: parseInt(process.env.CHARACTER_MIN_DEX || '30'),
    constitution: parseInt(process.env.CHARACTER_MIN_CON || '30'),
    intelligence: parseInt(process.env.CHARACTER_MIN_INT || '15'),
    education: parseInt(process.env.CHARACTER_MIN_EDU || '15'),
    power: parseInt(process.env.CHARACTER_MIN_POW || '15'),
    appearance: parseInt(process.env.CHARACTER_MIN_CHA || '15')
  };

  const minimumTotal = Object.values(minStats).reduce((sum, val) => sum + val, 0);

  // Check each stat against minimum
  let statsAbove80 = 0;
  for (const [statName, minValue] of Object.entries(minStats)) {
    const currentValue = (character.stats as any)[statName] || 0;

    if (currentValue < minValue) {
      result.errors.push(`${statName} cannot be below ${minValue} (current: ${currentValue})`);
      result.isValid = false;
    }

    if (currentValue > 80) {
      statsAbove80++;
    }
  }

  // Check total points spent
  const actualTotal = Object.values(character.stats).reduce((sum, val) => sum + val, 0) - minimumTotal;

  if (actualTotal < statTotal) {
    result.errors.push(`You must spend all ${statTotal} stat points (spent: ${actualTotal})`);
    result.isValid = false;
  } else if (actualTotal > statTotal) {
    result.errors.push(`You have exceeded stat point budget (${actualTotal} > ${statTotal})`);
    result.isValid = false;
  }

  if (statsAbove80 > maxStatsAbove80) {
    result.errors.push(`Maximum ${maxStatsAbove80} stats can be above 80 (you have ${statsAbove80})`);
    result.isValid = false;
  }

  // ====== OCCUPATION VALIDATION ======
  if (!character.occupation) {
    result.errors.push('Character must select an occupation');
    result.isValid = false;
    return result; // Can't validate skills without occupation
  }

  // Fetch occupation details
  const occupation = await Occupation.findById(character.occupation).populate('requiredSkills.skillId').populate('requiredSkills.alternatives');

  if (!occupation) {
    result.errors.push('Selected occupation not found in database');
    result.isValid = false;
    return result;
  }

  // ====== SKILLS VALIDATION ======
  const skillPoints = calculateAvailableSkillPoints(character);
  const skillCap = skillPoints.skillCap;
  const finalSkillCap = skillPoints.finalSkillCap;

  // Calculate total points spent on skills
  let skillPointsSpent = 0;
  const skillEntries = Object.entries(character.skills);

  for (const [skillName, skillValue] of skillEntries) {
    // Fetch skill to get base value
    const skill = await Skill.findOne({ name: skillName });

    if (!skill) {
      result.warnings.push(`Skill "${skillName}" not found in database`);
      continue;
    }

    const baseValue = skill.baseValue || 0;
    const pointsSpent = Math.max(0, skillValue - baseValue);
    skillPointsSpent += pointsSpent;

    // Check cap (allow final cap if occupation bonuses applied)
    const maxAllowed = character.occupationBonusesApplied ? finalSkillCap : skillCap;

    if (skillValue > maxAllowed) {
      result.errors.push(`Skill "${skillName}" exceeds cap (${skillValue} > ${maxAllowed})`);
      result.isValid = false;
    }
  }

  if (skillPointsSpent > skillPoints.totalAvailable) {
    result.errors.push(`Skill points exceeded (spent: ${skillPointsSpent}, available: ${skillPoints.totalAvailable})`);
    result.isValid = false;
  } else if (skillPointsSpent < skillPoints.totalAvailable) {
    result.errors.push(`You must spend all skill points (spent: ${skillPointsSpent}, available: ${skillPoints.totalAvailable})`);
    result.isValid = false;
  }

  // Check that all 6 required skills have been improved
  let requiredSkillsImproved = 0;

  for (const requiredSkill of occupation.requiredSkills) {
    const skill = await Skill.findById(requiredSkill.skillId);

    if (!skill) continue;

    const skillValue = character.skills[skill.name] || 0;
    const baseValue = skill.baseValue || 0;

    if (skillValue > baseValue) {
      requiredSkillsImproved++;
    }
  }

  if (requiredSkillsImproved < 6) {
    result.errors.push(`All 6 required occupation skills must be improved (${requiredSkillsImproved}/6 improved)`);
    result.isValid = false;
  }

  // ====== BACKGROUND VALIDATION ======
  if (!character.background || !character.backgroundCompleted) {
    result.errors.push('Character background must be completed');
    result.isValid = false;
  }

  // Check minimum background fields
  if (character.background) {
    if (!character.background.briefHistory || character.background.briefHistory.length < 100) {
      result.errors.push('Brief history must be at least 100 characters');
      result.isValid = false;
    }

    if (!character.background.personality || character.background.personality.length < 50) {
      result.errors.push('Personality description must be at least 50 characters');
      result.isValid = false;
    }

    if (!character.background.goalsAndMotivations || character.background.goalsAndMotivations.length < 50) {
      result.errors.push('Goals and motivations must be at least 50 characters');
      result.isValid = false;
    }
  }

  logger.info('Character validation completed', {
    characterId: character.id,
    isValid: result.isValid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length
  });

  return result;
}

/**
 * Check if a character meets the prerequisites for an occupation
 *
 * @param character - The character to check
 * @param occupation - The occupation to check against
 * @returns Object with canAccess boolean and list of issues
 */
export async function checkOccupationPrerequisites(
  character: ICharacter,
  occupation: IOccupation
): Promise<{ canAccess: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Use the method from Occupation model if available
  if (typeof (occupation as any).checkPrerequisites === 'function') {
    return (occupation as any).checkPrerequisites(character, [], []);
  }

  // Fallback: basic checks
  if (!occupation.allowedGenders.includes(character.gender)) {
    issues.push(`Gender requirement not met (requires ${occupation.allowedGenders.join(' or ')})`);
  }

  // Check minimum age if specified
  if (occupation.prerequisites?.minimumAge && character.age < occupation.prerequisites.minimumAge) {
    issues.push(`Minimum age requirement not met (requires ${occupation.prerequisites.minimumAge})`);
  }

  // Check maximum age if specified
  if (occupation.prerequisites?.maximumAge && character.age > occupation.prerequisites.maximumAge) {
    issues.push(`Maximum age requirement not met (maximum ${occupation.prerequisites.maximumAge})`);
  }

  return {
    canAccess: issues.length === 0,
    issues
  };
}
