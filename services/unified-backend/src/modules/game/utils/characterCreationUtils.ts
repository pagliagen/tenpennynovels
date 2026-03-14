import { Character, Occupation, Skill } from '@database/models';
import { ICharacter } from '@database/models/Character';
import { IOccupation } from '@database/models/Occupation';
import { CharacterCreationConfig, calculateIntelligenceBonus } from '@shared/services/CharacterCreationConfigService';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';
import { logger } from '../logger';

/**
 * Character Creation Utilities
 *
 * Helper functions for the new character creation system based on Call of Cthulhu rules.
 * Implements the new occupation system with required skills (6) and bonus skills (1-2).
 */

/**
 * Create ConfigurationService instance
 * Helper to avoid repeating instantiation code
 */
function getConfigService(): ConfigurationService {
  return new ConfigurationService(redis.getClient() as any, logger);
}

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
 * Resolve a Skill's baseValue to a numeric value.
 * Handles: number, "VALUE:XX", "FORMULA:STAT" (resolves against character stats).
 */
function resolveBaseValue(baseValue: string | number, characterStats?: Record<string, number>): number {
  if (typeof baseValue === 'number') return baseValue;
  if (typeof baseValue !== 'string') return 0;

  if (baseValue.startsWith('VALUE:')) {
    return parseInt(baseValue.replace('VALUE:', '')) || 0;
  }

  if (baseValue.startsWith('FORMULA:')) {
    const stat = baseValue.replace('FORMULA:', '').toLowerCase();
    if (!characterStats) return 0;
    const statMapping: Record<string, string> = {
      str: 'strength', dex: 'dexterity', int: 'intelligence',
      con: 'constitution', app: 'charm', pow: 'power',
      siz: 'size', edu: 'education',
    };
    const fullStat = statMapping[stat] || stat;
    return characterStats[fullStat] || characterStats[stat] || 0;
  }

  const parsed = parseInt(baseValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate available skill points for a character
 *
 * Formula: flat value from SystemConfiguration (default 250, replaces old formula 200+INT/2)
 *
 * @param character - The character object
 * @param config - Character creation configuration
 * @param totalSkillPoints - Total skill points from SystemConfiguration (optional, for async fetch)
 * @returns Skill points calculation breakdown
 */
export function calculateAvailableSkillPoints(
  character: ICharacter,
  config: CharacterCreationConfig,
  totalSkillPoints?: number
): SkillPointsCalculation {
  // Use flat value from SystemConfiguration (passed as parameter) or fallback to 250
  const totalAvailable = totalSkillPoints ?? 250;

  // For backward compatibility, keep basePoints and intBonus fields but set to total and 0
  const basePoints = totalAvailable;
  const intBonus = 0;

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
 * Grants automatic bonus skills that don't count against
 * the character's skill point budget. These bonuses can push skills above
 * the normal cap (creationCap) up to the final cap (creationCapWithOccupation).
 *
 * bonusSkills are expected to have populated skillId (via .populate('bonusSkills.skillId')).
 */
export async function applyOccupationBonuses(
  character: ICharacter,
  occupation: IOccupation,
  config: CharacterCreationConfig,
  selectedAlternatives?: { [slotIndex: string]: string }
): Promise<OccupationBonusResult> {
  const result: OccupationBonusResult = {
    bonusesApplied: [],
    exceededCap: false,
    warnings: []
  };

  const finalSkillCap = config.skills.creationCapWithOccupation || 80;

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

  if (!character.skills) {
    character.skills = {};
  }

  for (const bonusSkill of occupation.bonusSkills) {
    try {
      // skillId may be populated (object with _id/name) or a raw ObjectId
      const populatedSkill = typeof bonusSkill.skillId === 'object' && bonusSkill.skillId !== null
        ? bonusSkill.skillId as any
        : null;

      const skill = populatedSkill || await Skill.findById(bonusSkill.skillId);
      if (!skill) {
        result.warnings.push(`Bonus skill with ID ${bonusSkill.skillId} not found`);
        continue;
      }

      const skillId = (skill._id || skill.id).toString();
      const skillName = skill.name;
      const currentValue = character.skills[skillId] || skill.baseValue || 0;
      const bonusValue = bonusSkill.bonusValue;
      const newValue = (typeof currentValue === 'number' ? currentValue : 0) + bonusValue;

      if (newValue > finalSkillCap) {
        result.exceededCap = true;
        result.warnings.push(
          `Bonus for ${skillName} would exceed cap (${newValue} > ${finalSkillCap}). Capping at ${finalSkillCap}.`
        );
        character.skills[skillId] = finalSkillCap;
      } else {
        character.skills[skillId] = newValue;
      }

      result.bonusesApplied.push({
        skillId,
        skillName,
        bonusValue,
        finalValue: character.skills[skillId] as number
      });

    } catch (error: any) {
      logger.error('Error applying bonus skill', {
        error: error.message,
        bonusSkillId: String(bonusSkill.skillId)
      });
      result.warnings.push(`Failed to apply bonus for skill ${bonusSkill.skillId}: ${error.message}`);
    }
  }

  character.occupationBonusesApplied = true;

  // Store selected slot choices (slot index -> chosen skill ObjectId)
  if (selectedAlternatives) {
    const mongoose = await import('mongoose');
    const alternativesAsObjectIds: any = {};
    for (const [slotIndex, skillId] of Object.entries(selectedAlternatives)) {
      alternativesAsObjectIds[slotIndex] = new mongoose.Types.ObjectId(skillId);
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
    playerStatus: character.playerStatus
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
  // Fetch dynamic config values from SystemConfiguration
  const configService = getConfigService();
  const statTotalConfig = await configService.getConfig('character_creation_stat_total_points');
  const statMinConfig = await configService.getConfig('character_creation_stat_minimum');

  const statTotal = statTotalConfig ?? config.stats.totalPoints ?? 450;
  const statMinimum = statMinConfig ?? config.stats.basePoints ?? 20;
  const maxStatsAbove80 = config.stats.maxStatsAbove80 || 2;
  const statCreationCap = config.stats.creationCap || 85;

  // Calculate minimum points from config
  const minStats = {
    strength: statMinimum,
    size: statMinimum,
    dexterity: statMinimum,
    constitution: statMinimum,
    intelligence: statMinimum,
    education: statMinimum,
    power: statMinimum,
    appearance: statMinimum
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

  // Fetch occupation details with populated skill refs
  const occupation = await Occupation.findById(character.occupation)
    .populate('requiredSkillSlots.options')
    .populate('bonusSkills.skillId');

  if (!occupation) {
    result.errors.push('L\'esperienza pregressa selezionata non è stata trovata nel database');
    result.isValid = false;
    return result;
  }

  // ====== SKILLS VALIDATION ======
  // Fetch dynamic skill points total from SystemConfiguration
  const skillTotalConfig = await configService.getConfig('character_creation_skill_total_points');
  const totalSkillPoints = skillTotalConfig ?? 250;

  const skillPoints = calculateAvailableSkillPoints(character, config, totalSkillPoints);
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

    // Handle granular skill breakdown (object) vs simple number
    let totalValue: number;
    let manualPoints: number = 0;
    let requiredBonus: number = 0;
    let occupationBonus: number = 0;
    let skillDisplayName: string;

    if (!skill) {
      // Check if this is a dynamic/placeholder skill (e.g., "Lingua straniera (Latino)")
      const dynamicEntry = (character.dynamicSkills || []).find(
        (ds: any) => ds.skillName === skillKey
      );

      if (!dynamicEntry) {
        result.warnings.push(`Abilità "${skillKey}" non trovata nel database`);
        continue;
      }

      // Dynamic skill found — use its breakdown directly and count the points
      skillDisplayName = dynamicEntry.skillName;

      if (typeof skillValue === 'object' && skillValue !== null && 'total' in skillValue) {
        totalValue = (skillValue as any).total;
        manualPoints = (skillValue as any).manualPoints || 0;
        requiredBonus = (skillValue as any).requiredBonus || 0;
        occupationBonus = (skillValue as any).occupationBonus || 0;
      } else {
        totalValue = typeof skillValue === 'number' ? skillValue : 0;
        manualPoints = totalValue;
      }
    } else {
      skillDisplayName = skill.name;

      if (typeof skillValue === 'object' && skillValue !== null && 'total' in skillValue) {
        totalValue = (skillValue as any).total;
        manualPoints = (skillValue as any).manualPoints || 0;
        requiredBonus = (skillValue as any).requiredBonus || 0;
        occupationBonus = (skillValue as any).occupationBonus || 0;
      } else {
        totalValue = typeof skillValue === 'number' ? skillValue : 0;
        const baseValue = skill.baseValue || 0;
        manualPoints = Math.max(0, totalValue - baseValue);
      }
    }

    // Budget calculation: manualPoints + requiredBonus count, occupationBonus does NOT
    const pointsSpent = manualPoints + requiredBonus;
    skillPointsSpent += pointsSpent;

    // Check cap (allow final cap if occupation bonuses applied)
    const maxAllowed = character.occupationBonusesApplied ? finalSkillCap : skillCap;

    if (totalValue > maxAllowed) {
      result.errors.push(`L'abilità "${skillDisplayName}" supera il limite (${totalValue} > ${maxAllowed})`);
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

  // Check that all required skill slots have been satisfied.
  // Each slot contains 1+ skill options (populated ObjectIds).
  // 1 option = mandatory skill; N options = player picks one.

  // Extract required minimum from config
  const requiredSkillMinimum = config.occupation.requiredSkillMinimum || 40;

  let slotsValidated = 0;
  const totalSlots = occupation.requiredSkillSlots?.length || 0;

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const slot = (occupation.requiredSkillSlots || [])[slotIdx];
    const options = (slot?.options || []) as any[];
    if (options.length === 0) continue;

    let slotSatisfied = false;

    for (const skillRef of options) {
      const skill = typeof skillRef === 'object' && skillRef._id
        ? skillRef
        : await Skill.findById(skillRef);
      if (!skill) continue;

      const skillName = skill.name;

      // Handle PLACEHOLDER SKILLS (e.g., "Lingua straniera")
      if (skill.isPlaceholder) {
        // Check character.dynamicSkills for specializations of this placeholder
        const dynamicEntries = (character.dynamicSkills || []).filter(
          (ds: any) => ds.basedOnTemplate === skillName
        );

        if (dynamicEntries.length > 0) {
          const resolvedBase = resolveBaseValue(skill.baseValue, character.stats as any);
          const hasImproved = dynamicEntries.some((ds: any) => {
            if (ds.value >= requiredSkillMinimum) return true;
            const skillId = ds.skillId?.toString();
            if (skillId) {
              const skillData = skillsObj[skillId];
              if (skillData && typeof skillData === 'object' && 'total' in skillData) {
                return (skillData as any).total >= requiredSkillMinimum;
              }
              if (typeof skillData === 'number') return skillData >= requiredSkillMinimum;
            }
            return false;
          });

          if (hasImproved) {
            slotSatisfied = true;
            break;
          }
        }

        // Fallback: check skills map for name-based keys (legacy support)
        for (const [charSkillKey, charSkillValue] of skillEntries) {
          if (charSkillKey.startsWith(`${skillName} (`)) {
            let totalValue = 0;
            if (typeof charSkillValue === 'object' && charSkillValue !== null && 'total' in charSkillValue) {
              totalValue = (charSkillValue as any).total;
            } else if (typeof charSkillValue === 'number') {
              totalValue = charSkillValue;
            }
            if (totalValue >= requiredSkillMinimum) {
              slotSatisfied = true;
              break;
            }
          }
        }
        if (slotSatisfied) break;
        continue;
      }

      // NORMAL SKILL: check by ObjectId
      const skillId = (skill._id || skill.id).toString();
      let skillValue = 0;
      if (character.skills instanceof Map) {
        const value = character.skills.get(skillId);
        if (typeof value === 'object' && value !== null && 'total' in value) {
          skillValue = (value as any).total;
        } else if (typeof value === 'number') {
          skillValue = value;
        }
      } else {
        const value = (character.skills as any)?.[skillId];
        if (typeof value === 'object' && value !== null && 'total' in value) {
          skillValue = (value as any).total;
        } else if (typeof value === 'number') {
          skillValue = value;
        }
      }

      const resolvedBase = resolveBaseValue(skill.baseValue, character.stats as any);
      if (skillValue >= requiredSkillMinimum) {
        slotSatisfied = true;
        break;
      }
    }

    if (slotSatisfied) {
      slotsValidated++;
    } else {
      const optionNames = options.map((o: any) => o.name || 'Sconosciuta').join(' o ');
      if (options.length === 1) {
        result.errors.push(`Abilità richiesta "${optionNames}" deve avere almeno ${requiredSkillMinimum} punti (valore attuale insufficiente)`);
      } else {
        result.errors.push(`Slot ${slotIdx + 1}: almeno una tra ${optionNames} deve avere almeno ${requiredSkillMinimum} punti`);
      }
      result.isValid = false;
    }
  }

  if (totalSlots > 0 && slotsValidated < totalSlots) {
    result.errors.push(`${slotsValidated}/${totalSlots} slot abilità richieste soddisfatti`);
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

  return {
    canAccess: issues.length === 0,
    issues
  };
}
