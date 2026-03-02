import { Character, Occupation, Skill } from '@database/models';
import { ICharacter } from '@database/models/Character';
import { IOccupation } from '@database/models/Occupation';
import { CharacterCreationConfig, calculateIntelligenceBonus } from '@shared/services/CharacterCreationConfigService';
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
 * Formula: base points (from config) + INT/intelligenceBonusDivisor bonus
 *
 * @param character - The character object
 * @param config - Character creation configuration
 * @returns Skill points calculation breakdown
 */
export function calculateAvailableSkillPoints(character: ICharacter, config: CharacterCreationConfig): SkillPointsCalculation {
  // Parse base points from formula (currently constant, future: formula)
  const formula = config.skills.totalPointsFormula || 'constant:200';
  let basePoints = 200;
  if (formula.startsWith('constant:')) {
    basePoints = parseInt(formula.replace('constant:', '')) || 200;
  }

  const intelligenceBonusFormula = config.skills.intelligenceBonusFormula || 'INT/2';
  const intBonus = calculateIntelligenceBonus(intelligenceBonusFormula, character.stats.intelligence || 0);
  const totalAvailable = basePoints + intBonus;

  // Skill caps from config
  const skillCap = config.skills.creationCap || 75;
  const finalSkillCap = config.skills.creationCapWithOccupation || 80;

  logger.debug('Calculating skill points', {
    characterId: character._id.toString(),
    intelligence: character.stats.intelligence,
    basePoints,
    intBonus,
    totalAvailable,
    skillCap,
    finalSkillCap
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
 * the normal cap (creationCap) up to the final cap (creationCapWithOccupation).
 *
 * @param character - The character to apply bonuses to
 * @param occupation - The occupation with bonus skills
 * @param config - Character creation configuration
 * @param selectedAlternatives - Map of requirement ID to selected alternative skill ID (for choice skills)
 * @returns Result of bonus application with details
 */
export async function applyOccupationBonuses(
  character: ICharacter,
  occupation: IOccupation,
  config: CharacterCreationConfig,
  selectedAlternatives?: { [requirementId: string]: string }
): Promise<OccupationBonusResult> {
  const result: OccupationBonusResult = {
    bonusesApplied: [],
    exceededCap: false,
    warnings: []
  };

  const finalSkillCap = config.skills.creationCapWithOccupation || 80;

  // Validate occupation has bonusSkills
  if (!occupation.bonusSkills || occupation.bonusSkills.length === 0) {
    result.warnings.push('Occupation has no bonus skills defined');
    return result;
  }

  logger.info('Applying occupation bonuses', {
    characterId: character._id.toString(),
    occupationId: occupation._id.toString(),
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
        finalValue: character.skills[skillName] as number
      });

      logger.debug('Applied bonus skill', {
        characterId: character._id.toString(),
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

  // Store selected alternative skills if provided (convert string IDs to ObjectIds)
  if (selectedAlternatives) {
    const mongoose = await import('mongoose');
    const alternativesAsObjectIds: any = {};
    for (const [requirementId, skillId] of Object.entries(selectedAlternatives)) {
      alternativesAsObjectIds[requirementId] = new mongoose.Types.ObjectId(skillId);
    }
    character.selectedAlternativeSkills = alternativesAsObjectIds;
  }

  logger.info('Occupation bonuses applied', {
    characterId: character._id.toString(),
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
 * - Stats total is within allowed range (config points + minimums)
 * - Skills total doesn't exceed available points
 * - All required skills for occupation have been improved
 * - No skill exceeds the cap
 * - Character has selected an occupation
 * - Background is complete
 *
 * @param character - The character to validate
 * @param config - Character creation configuration
 * @returns Validation result with errors and warnings
 */
export async function validateCharacterSubmission(character: ICharacter, config: CharacterCreationConfig): Promise<CharacterValidationResult> {
  const result: CharacterValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  logger.info('Validating character for submission', {
    characterId: character._id.toString(),
    characterName: character.name,
    status: character.status
  });

  // ====== BASIC INFO VALIDATION ======
  if (!character.name || character.name.trim() === '' || character.name === 'New Character') {
    result.errors.push('Il nome del personaggio è obbligatorio');
    result.isValid = false;
  }

  if (!character.age || character.age < 16 || character.age > 80) {
    result.errors.push(`L'età del personaggio deve essere tra 16 e 80 anni (attuale: ${character.age || 'non impostata'})`);
    result.isValid = false;
  }

  if (!character.apparentAge || character.apparentAge < 16 || character.apparentAge > 80) {
    result.errors.push(`L'età apparente del personaggio deve essere tra 16 e 80 anni (attuale: ${character.apparentAge || 'non impostata'})`);
    result.isValid = false;
  }

  if (!character.gender) {
    result.errors.push('Il genere del personaggio è obbligatorio');
    result.isValid = false;
  }

  if (!character.publicDescription || character.publicDescription.length < 50) {
    result.errors.push(`La descrizione pubblica deve essere di almeno 50 caratteri (attuale: ${character.publicDescription?.length || 0})`);
    result.isValid = false;
  }

  if (!character.privateDescription || character.privateDescription.length < 50) {
    result.errors.push(`La descrizione privata deve essere di almeno 50 caratteri (attuale: ${character.privateDescription?.length || 0})`);
    result.isValid = false;
  }

  // ====== STATS VALIDATION ======
  const statTotal = config.stats.totalPoints || 400;
  const maxStatsAbove80 = config.stats.maxStatsAbove80 || 2;
  const statCreationCap = config.stats.creationCap || 85;

  // Calculate minimum points from config
  const minStats = {
    strength: config.stats.basePoints || 20,
    size: config.stats.basePoints || 20,
    dexterity: config.stats.basePoints || 20,
    constitution: config.stats.basePoints || 20,
    intelligence: config.stats.basePoints || 20,
    education: config.stats.basePoints || 20,
    power: config.stats.basePoints || 20,
    appearance: config.stats.basePoints || 20
  };

  const minimumTotal = Object.values(minStats).reduce((sum, val) => sum + val, 0);

  // Check each stat against minimum
  // Map appearance to charm (the actual field name in Character schema)
  const statMapping: { [key: string]: string } = {
    appearance: 'charm'
  };
  
  let statsAbove80 = 0;
  for (const [statName, minValue] of Object.entries(minStats)) {
    const actualStatName = statMapping[statName] || statName;
    const currentValue = (character.stats as any)[actualStatName] || 0;

    if (currentValue < minValue) {
      // Translate stat names to Italian
      const statNames: { [key: string]: string } = {
        strength: 'Forza',
        size: 'Taglia',
        dexterity: 'Destrezza',
        constitution: 'Costituzione',
        intelligence: 'Intelligenza',
        education: 'Educazione',
        power: 'Potere',
        appearance: 'Fascino'
      };
      const statNameIt = statNames[statName] || statName;
      result.errors.push(`${statNameIt} non può essere inferiore a ${minValue} (attuale: ${currentValue})`);
      result.isValid = false;
    }

    if (currentValue > 80) {
      statsAbove80++;
    }
  }

  // Check total points (all stats count toward 400 budget, including minimums)
  const actualTotal = Object.values(character.stats).reduce((sum, val) => sum + val, 0);

  if (actualTotal < statTotal) {
    result.errors.push(`Il totale delle caratteristiche deve essere ${statTotal} (attuale: ${actualTotal}, mancanti: ${statTotal - actualTotal})`);
    result.isValid = false;
  } else if (actualTotal > statTotal) {
    result.errors.push(`Hai superato il budget di punti caratteristica (totale: ${actualTotal}, massimo: ${statTotal})`);
    result.isValid = false;
  }

  if (statsAbove80 > maxStatsAbove80) {
    result.errors.push(`Massimo ${maxStatsAbove80} caratteristiche possono essere sopra 80 (ne hai ${statsAbove80})`);
    result.isValid = false;
  }

  // ====== OCCUPATION VALIDATION ======
  if (!character.occupation) {
    result.errors.push('Il personaggio deve selezionare un\'esperienza pregressa');
    result.isValid = false;
    return result; // Can't validate skills without occupation
  }

  // Fetch occupation details
  const occupation = await Occupation.findById(character.occupation).populate('requiredSkills.skillId').populate('requiredSkills.alternatives');

  if (!occupation) {
    result.errors.push('L\'esperienza pregressa selezionata non è stata trovata nel database');
    result.isValid = false;
    return result;
  }

  // ====== SKILLS VALIDATION ======
  const skillPoints = calculateAvailableSkillPoints(character, config);
  const skillCap = skillPoints.skillCap;
  const finalSkillCap = skillPoints.finalSkillCap;

  // Calculate total points spent on skills
  let skillPointsSpent = 0;
  
  // Handle Mongoose Map - convert to object and filter out internal properties
  let skillsObj: any = {};
  if (character.skills instanceof Map) {
    character.skills.forEach((value, key) => {
      // Filter out Mongoose internal properties
      if (!key.startsWith('$__')) {
        skillsObj[key] = value;
      }
    });
  } else {
    skillsObj = character.skills || {};
  }
  
  const skillEntries = Object.entries(skillsObj);

  for (const [skillKey, skillValue] of skillEntries) {
    // Skip Mongoose internal properties
    if (skillKey.startsWith('$__')) {
      continue;
    }

    // Fetch skill by ID (keys are ObjectId strings now, not skill names)
    let skill;
    if (skillKey.match(/^[0-9a-f]{24}$/i)) {
      // ObjectId format - search by ID
      skill = await Skill.findById(skillKey);
    } else {
      // Legacy name format - search by name (for backward compatibility)
      skill = await Skill.findOne({ name: skillKey });
    }

    if (!skill) {
      result.warnings.push(`Abilità "${skillKey}" non trovata nel database`);
      continue;
    }

    // Handle granular skill breakdown (object) vs simple number
    let totalValue: number;
    let manualPoints: number = 0;
    let requiredBonus: number = 0;
    let occupationBonus: number = 0;

    if (typeof skillValue === 'object' && skillValue !== null && 'total' in skillValue) {
      // Granular breakdown available
      totalValue = (skillValue as any).total;
      manualPoints = (skillValue as any).manualPoints || 0;
      requiredBonus = (skillValue as any).requiredBonus || 0;
      occupationBonus = (skillValue as any).occupationBonus || 0;
    } else {
      // Legacy: simple number (calculate as if all manual)
      totalValue = typeof skillValue === 'number' ? skillValue : 0;
      const baseValue = skill.baseValue || 0;
      manualPoints = Math.max(0, totalValue - baseValue);
    }

    // Budget calculation: manualPoints + requiredBonus count, occupationBonus does NOT
    const pointsSpent = manualPoints + requiredBonus;
    skillPointsSpent += pointsSpent;

    // Check cap (allow final cap if occupation bonuses applied)
    const maxAllowed = character.occupationBonusesApplied ? finalSkillCap : skillCap;

    if (totalValue > maxAllowed) {
      result.errors.push(`L'abilità "${skill.name}" supera il limite (${totalValue} > ${maxAllowed})`);
      result.isValid = false;
    }
  }

  if (skillPointsSpent > skillPoints.totalAvailable) {
    result.errors.push(`Hai superato i punti abilità disponibili (spesi: ${skillPointsSpent}, disponibili: ${skillPoints.totalAvailable})`);
    result.isValid = false;
  } else if (skillPointsSpent < skillPoints.totalAvailable) {
    result.errors.push(`Devi spendere tutti i punti abilità (spesi: ${skillPointsSpent}, disponibili: ${skillPoints.totalAvailable}, rimanenti: ${skillPoints.totalAvailable - skillPointsSpent})`);
    result.isValid = false;
  }

  // Check that all required skills have been improved
  // Use skillName instead of skillId (skillId is optional String, not ObjectId ref)
  let requiredSkillsImproved = 0;
  const totalRequiredSkills = occupation.requiredSkills?.length || 0;

  for (const requiredSkill of (occupation.requiredSkills || [])) {
    const skillName = requiredSkill.skillName;
    if (!skillName) continue;

    const skill = await Skill.findOne({ name: skillName });
    if (!skill) {
      result.warnings.push(`Abilità richiesta "${skillName}" non trovata nel database`);
      continue;
    }

    // Handle PLACEHOLDER SKILLS (e.g., "Lingua straniera")
    // Placeholder skills don't exist directly in character.skills
    // Instead, derived specializations like "Lingua straniera (Francese)" exist
    if (skill.isPlaceholder) {
      logger.info(`Validating placeholder skill: ${skillName}`);

      // Find all skills that match the pattern: "SkillName (Specialization)"
      const derivedSkills: { name: string; value: number }[] = [];

      // Search for derived skills in character.skills
      for (const [charSkillName, charSkillValue] of skillEntries) {
        // Match pattern: "Lingua straniera (Francese)"
        if (charSkillName.startsWith(`${skillName} (`)) {
          let totalValue: number = 0;
          if (typeof charSkillValue === 'object' && charSkillValue !== null && 'total' in charSkillValue) {
            totalValue = (charSkillValue as any).total;
          } else if (typeof charSkillValue === 'number') {
            totalValue = charSkillValue;
          }

          derivedSkills.push({ name: charSkillName, value: totalValue });
        }
      }

      // Validate: at least one specialization must exist
      if (derivedSkills.length === 0) {
        result.errors.push(`"${skillName}": devi aggiungere almeno una specializzazione`);
        result.isValid = false;
        continue; // Don't count as improved
      }

      // Validate: at least one specialization must meet the required minimum
      const requiredMinimum = requiredSkill.baseValue || 40;
      const hasValidSpecialization = derivedSkills.some(ds => ds.value >= requiredMinimum);

      if (!hasValidSpecialization) {
        result.errors.push(
          `"${skillName}": almeno una specializzazione deve raggiungere ${requiredMinimum} punti (trovate: ${derivedSkills.map(ds => `${ds.name}: ${ds.value}`).join(', ')})`
        );
        result.isValid = false;
        continue; // Don't count as improved
      }

      // Placeholder skill validated successfully
      requiredSkillsImproved++;
      logger.info(`Placeholder skill validated: ${skillName} (${derivedSkills.length} specializations, min ${requiredMinimum})`);
      continue;
    }

    // NORMAL SKILL VALIDATION (non-placeholder)
    // Get skill value from character using ObjectId key (not name)
    const skillId = skill._id.toString();
    let skillValue: number = 0;
    if (character.skills instanceof Map) {
      const value = character.skills.get(skillId);
      if (typeof value === 'object' && value !== null && 'total' in value) {
        skillValue = (value as any).total;
      } else if (typeof value === 'number') {
        skillValue = value;
      }
    } else {
      const value = (character.skills as any)[skillId];
      if (typeof value === 'object' && value !== null && 'total' in value) {
        skillValue = (value as any).total;
      } else if (typeof value === 'number') {
        skillValue = value;
      }
    }

    const baseValue = skill.baseValue || 0;
    const requiredMinimum = requiredSkill.baseValue || 40;

    // Check if skill meets the required minimum
    if (skillValue >= requiredMinimum) {
      requiredSkillsImproved++;
    }
  }

  if (totalRequiredSkills > 0 && requiredSkillsImproved < totalRequiredSkills) {
    result.errors.push(`Tutte le ${totalRequiredSkills} abilità richieste dall'esperienza pregressa devono essere migliorate (${requiredSkillsImproved}/${totalRequiredSkills} migliorate)`);
    result.isValid = false;
  }

  // ====== BACKGROUND VALIDATION ======
  // Check required background fields directly (don't rely on backgroundCompleted flag)
  const backgroundErrors: string[] = [];
  
  // Required: publicDescription and privateDescription (legacy fields)
  if (!character.publicDescription || character.publicDescription.trim().length < 50) {
    backgroundErrors.push(`La descrizione pubblica deve essere di almeno 50 caratteri (attuale: ${character.publicDescription?.trim().length || 0})`);
  }

  if (!character.privateDescription || character.privateDescription.trim().length < 50) {
    backgroundErrors.push(`La descrizione privata deve essere di almeno 50 caratteri (attuale: ${character.privateDescription?.trim().length || 0})`);
  }

  // Required: structured background fields
  if (character.background) {
    if (!character.background.briefHistory || character.background.briefHistory.trim().length < 100) {
      backgroundErrors.push(`La storia breve deve essere di almeno 100 caratteri (attuale: ${character.background.briefHistory?.trim().length || 0})`);
    }

    if (!character.background.personality || character.background.personality.trim().length < 50) {
      backgroundErrors.push(`La descrizione della personalità deve essere di almeno 50 caratteri (attuale: ${character.background.personality?.trim().length || 0})`);
    }

    if (!character.background.goalsAndMotivations || character.background.goalsAndMotivations.trim().length < 50) {
      backgroundErrors.push(`Obiettivi e motivazioni devono essere di almeno 50 caratteri (attuale: ${character.background.goalsAndMotivations?.trim().length || 0})`);
    }
  } else {
    // If background object doesn't exist, check if at least legacy fields are present
    if (!character.publicDescription || character.publicDescription.trim().length < 50) {
      backgroundErrors.push('Il background del personaggio deve essere completato');
    }
  }

  // Add all background errors
  if (backgroundErrors.length > 0) {
    result.errors.push(...backgroundErrors);
    result.isValid = false;
  }

  logger.info('Character validation completed', {
    characterId: character._id.toString(),
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
  if (occupation.allowedGenders && !occupation.allowedGenders.includes(character.gender)) {
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
