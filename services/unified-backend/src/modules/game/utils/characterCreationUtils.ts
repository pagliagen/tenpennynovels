import { Character, ICharacter, SkillBreakdown } from '@core/character/models/Character';
import { Skill } from '@database/models';
// boundary-allow: debito dichiarato, characterCreationUtils.ts resta fuori dalla feature occupazioni (Fase 6.2) fino al consolidamento del core (Fase 7)
import { Occupation, IOccupation } from '@features/occupazioni/models/Occupation';
import { CharacterCreationConfig, calculateStatFormula } from '@shared/services/CharacterCreationConfigService';
import { logger } from '../logger';

/**
 * Character Creation Utilities
 *
 * Helper functions for the new character creation system based on Call of Cthulhu rules.
 * Implements the new occupation system with required skills (6) and bonus skills (1-2).
 */

/**
 * Punti "liberi" (pool base): unica sorgente di verità.
 *
 * Il valore vive in SystemConfiguration come formula
 * (`character_creation_skills_total_points_formula`, default `constant:200`).
 * Chiunque debba conoscere il pool base DEVE passare da qui: prima esistevano
 * tre parser duplicati (qui, in CharacterCreationController e in
 * CharacterCreationConfigService) e due fallback diversi (200 e 250), quindi
 * lo stesso personaggio riceveva un budget diverso a seconda dell'endpoint
 * che rispondeva.
 *
 * `formula:` non è implementato (nessun uso reale): logga e ricade sul default.
 */
export const DEFAULT_BASE_SKILL_POINTS = 200;

export function parseBaseSkillPoints(formula: string | undefined): number {
  if (formula?.startsWith('constant:')) {
    const parsed = Number.parseInt(formula.replace('constant:', ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BASE_SKILL_POINTS;
  }
  if (formula) {
    logger.warn('Formula-based skill points not implemented, falling back to default', {
      formula,
      fallback: DEFAULT_BASE_SKILL_POINTS,
    });
  }
  return DEFAULT_BASE_SKILL_POINTS;
}

interface SkillPointsCalculation {
  basePool: number; // Punti liberi, spendibili su qualsiasi abilità
  occPool: number; // EDU x N, spendable ONLY on occupation-eligible skills
  hobbyPool: number; // INT x N, spendable ONLY on non-occupation skills
  totalAvailable: number; // basePool + occPool + hobbyPool
  occupationRequiredSkills: number; // Number of skills that must be improved (always 6)
  skillCap: number; // Maximum value per skill during creation (default 75)
  finalSkillCap: number; // Maximum value after occupation bonuses (default 80)
}

/**
 * The set of skills considered "occupation-eligible" for a given occupation:
 * every skill listed in any requiredSkillSlots option (all options, not just
 * the one the player ultimately picks for a multi-choice slot - the whole
 * list is "professional" per CoC rules) plus every bonusSkills entry.
 * Placeholder skills (e.g. "Lingua straniera") are tracked by name, since
 * their real dynamic entries don't have a fixed catalog skill ID.
 */
interface OccupationSkillSet {
  skillIds: Set<string>;
  placeholderNames: Set<string>;
}

/**
 * Build the occupation-eligible skill set for the EDU-pool / INT-pool split.
 * Expects requiredSkillSlots.options and bonusSkills.skillId to be populated
 * (same shape CharacterController/validateCharacterSubmission already fetch).
 */
/**
 * Una specializzazione di placeholder (es. "Lingua straniera (Francese)") pesca dal
 * pool Professione SOLO se è la principale — quella che occupa lo slot — e solo se
 * il template è sul listino dell'occupazione. Il listino concede UNA lingua: prima
 * bastava che il template fosse fra i placeholderNames e ogni lingua extra
 * consumava il pool EDUxN.
 *
 * `isPrimary` è stato introdotto dopo: sui draft che non ce l'hanno si ricade sul
 * marcatore implicito di allora, requiredBonus > 0.
 * Speculare a isOccupationSkill in apps/game/src/lib/utils/skillPools.ts.
 */
function isDynamicOccupationSkill(
  dynamicEntry: { basedOnTemplate: string; isPrimary?: boolean; requiredBonus?: number },
  occSkillSet: OccupationSkillSet
): boolean {
  if (!occSkillSet.placeholderNames.has(dynamicEntry.basedOnTemplate)) return false;
  return dynamicEntry.isPrimary ?? (dynamicEntry.requiredBonus || 0) > 0;
}

export function buildOccupationSkillSet(occupation: IOccupation): OccupationSkillSet {
  const skillIds = new Set<string>();
  const placeholderNames = new Set<string>();

  (occupation.requiredSkillSlots || []).forEach((slot: any) => {
    (slot.options || []).forEach((option: any) => {
      if (option && typeof option === 'object' && option._id) {
        if (option.isPlaceholder) {
          placeholderNames.add(option.name);
        } else {
          skillIds.add(option._id.toString());
        }
      } else if (option) {
        // Not populated - fall back to the raw ObjectId (can't tell if it's a placeholder)
        skillIds.add(option.toString());
      }
    });
  });

  (occupation.bonusSkills || []).forEach((bonusSkill: any) => {
    const skillId = bonusSkill.skillId;
    if (skillId && typeof skillId === 'object' && skillId._id) {
      if (skillId.isPlaceholder) {
        placeholderNames.add(skillId.name);
      } else {
        skillIds.add(skillId._id.toString());
      }
    } else if (skillId) {
      skillIds.add(skillId.toString());
    }
  });

  return { skillIds, placeholderNames };
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
    return Number.parseInt(baseValue.replace('VALUE:', '')) || 0;
  }

  if (baseValue.startsWith('FORMULA:')) {
    const stat = baseValue.replace('FORMULA:', '').toLowerCase();
    if (!characterStats) return 0;
    const statMapping: Record<string, string> = {
      str: 'strength', dex: 'dexterity', int: 'intelligence',
      con: 'constitution', app: 'appearance', pow: 'power',
      siz: 'size', edu: 'education',
    };
    const fullStat = statMapping[stat] || stat;
    return characterStats[fullStat] || characterStats[stat] || 0;
  }

  const parsed = Number.parseInt(baseValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate available skill points for a character
 *
 * Three pools:
 * - basePool: flat value from SystemConfiguration (default 200, replaces old formula 200+INT/2),
 *   spendable on any skill.
 * - occPool: EDU x N (config.skills.occupationPointsFormula), spendable ONLY on occupation skills.
 * - hobbyPool: INT x N (config.skills.hobbyPointsFormula), spendable ONLY on non-occupation skills.
 *
 * @param character - The character object
 * @param config - Character creation configuration
 * @param totalSkillPoints - Pool base già risolto (opzionale); se assente si deriva da config
 * @returns Skill points calculation breakdown
 */
export function calculateAvailableSkillPoints(
  character: ICharacter,
  config: CharacterCreationConfig,
  totalSkillPoints?: number
): SkillPointsCalculation {
  // Pool base da SystemConfiguration. Il parametro esiste solo per i chiamanti
  // che l'hanno già risolto; senza, lo si deriva dalla stessa config - mai un
  // literal diverso, vedi parseBaseSkillPoints.
  const basePool = totalSkillPoints ?? parseBaseSkillPoints(config.skills.totalPointsFormula);

  const occPool = Math.max(0, calculateStatFormula(
    config.skills.occupationPointsFormula || 'EDUx4',
    'EDU',
    character.stats.education
  ));
  const hobbyPool = Math.max(0, calculateStatFormula(
    config.skills.hobbyPointsFormula || 'INTx2',
    'INT',
    character.stats.intelligence
  ));

  const totalAvailable = basePool + occPool + hobbyPool;

  // Skill caps from config
  const skillCap = config.skills.creationCap || 75;
  const finalSkillCap = config.skills.creationCapWithOccupation || 80;

  logger.debug('Calculating skill points', {
    characterId: character._id.toString(),
    intelligence: character.stats.intelligence,
    education: character.stats.education,
    basePool,
    occPool,
    hobbyPool,
    totalAvailable,
    skillCap,
    finalSkillCap
  });

  return {
    basePool,
    occPool,
    hobbyPool,
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
        ? (bonusSkill.skillId as unknown as { _id: unknown; name: string; baseValue?: string | number; id?: string })
        : null;

      const skill = populatedSkill || await Skill.findById(bonusSkill.skillId);
      if (!skill) {
        result.warnings.push(`Bonus skill with ID ${bonusSkill.skillId} not found`);
        continue;
      }

      const skillId = String(skill._id ?? (skill as { id?: string }).id ?? '');
      const skillName = skill.name;
      const currentValue = (character.skills as Record<string, number | SkillBreakdown>)[skillId] ?? (skill as { baseValue?: number }).baseValue ?? 0;
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

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error applying bonus skill', {
        error: message,
        bonusSkillId: String(bonusSkill.skillId)
      });
      result.warnings.push(`Failed to apply bonus for skill ${bonusSkill.skillId}: ${message}`);
    }
  }

  character.occupationBonusesApplied = true;

  // Store selected slot choices (slot index -> chosen skill ObjectId)
  if (selectedAlternatives) {
    const mongoose = await import('mongoose');
    const alternativesAsObjectIds: Record<string, InstanceType<typeof mongoose.Types.ObjectId>> = {};
    for (const [slotIndex, skillId] of Object.entries(selectedAlternatives)) {
      alternativesAsObjectIds[slotIndex] = new mongoose.Types.ObjectId(skillId);
    }
    character.selectedAlternativeSkills = alternativesAsObjectIds as unknown as ICharacter['selectedAlternativeSkills'];
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

  // ====== STATS VALIDATION ======
  // Use the config object passed in (loaded via CharacterCreationConfigService.loadConfig())
  // to ensure consistency with what the API serves to the frontend.
  const statTotal = config.stats.totalPoints ?? 400;
  const statMinimum = config.stats.basePoints ?? 20;
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

  // Check each stat against minimum (no mapping needed - model now uses 'appearance')
  let statsAbove80 = 0;
  for (const [statName, minValue] of Object.entries(minStats)) {
    const currentValue = (character.stats as Record<string, number>)[statName] || 0;

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
  const skillPoints = calculateAvailableSkillPoints(character, config);
  const skillCap = skillPoints.skillCap;
  const finalSkillCap = skillPoints.finalSkillCap;

  // Occupation-eligible skill set, for the EDU-pool / INT-pool split.
  const occSkillSet = buildOccupationSkillSet(occupation);

  // Calculate points spent, split by pool (occupation-eligible vs hobby)
  let spentOcc = 0;
  let spentHobby = 0;
  const countedDynamicSkillNames = new Set<string>();

  // Handle Mongoose Map - convert to object and filter out internal properties
  let skillsObj: Record<string, number | SkillBreakdown> = {};
  if (character.skills instanceof Map) {
    character.skills.forEach((value, key) => {
      if (!key.startsWith('$__')) {
        skillsObj[key] = value;
      }
    });
  } else {
    skillsObj = (character.skills || {}) as Record<string, number | SkillBreakdown>;
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

    let isOccupationSkill = false;

    if (!skill) {
      // Check if this is a dynamic/placeholder skill keyed by its full name (legacy
      // format - the current wizard keys character.skills by a synthetic skillId that
      // never survives CharacterController's ObjectId-format filter, so dynamic skill
      // points normally live ONLY in character.dynamicSkills[] - see the dedicated
      // loop below this one, which is what actually counts them for fresh characters).
      const dynamicEntry = (character.dynamicSkills || []).find(
        (ds) => ds.skillName === skillKey
      );

      if (!dynamicEntry) {
        result.warnings.push(`Abilità "${skillKey}" non trovata nel database`);
        continue;
      }

      countedDynamicSkillNames.add(dynamicEntry.skillName);

      // Dynamic skill found — use its breakdown directly and count the points
      skillDisplayName = dynamicEntry.skillName;
      isOccupationSkill = isDynamicOccupationSkill(dynamicEntry, occSkillSet);

      if (typeof skillValue === 'object' && skillValue !== null && 'total' in skillValue) {
        const breakdown = skillValue as SkillBreakdown;
        totalValue = breakdown.total;
        manualPoints = breakdown.manualPoints || 0;
        requiredBonus = breakdown.requiredBonus || 0;
        occupationBonus = breakdown.occupationBonus || 0;
      } else {
        totalValue = typeof skillValue === 'number' ? skillValue : 0;
        manualPoints = totalValue;
      }
    } else {
      skillDisplayName = skill.name;
      isOccupationSkill = occSkillSet.skillIds.has(skill._id.toString());

      if (typeof skillValue === 'object' && skillValue !== null && 'total' in skillValue) {
        const breakdown = skillValue as SkillBreakdown;
        totalValue = breakdown.total;
        manualPoints = breakdown.manualPoints || 0;
        requiredBonus = breakdown.requiredBonus || 0;
        occupationBonus = breakdown.occupationBonus || 0;
      } else {
        totalValue = typeof skillValue === 'number' ? skillValue : 0;
        const baseValue = skill.baseValue || 0;
        manualPoints = Math.max(0, totalValue - baseValue);
      }
    }

    // Budget calculation: manualPoints + requiredBonus count, occupationBonus does NOT
    const pointsSpent = manualPoints + requiredBonus;
    if (isOccupationSkill) {
      spentOcc += pointsSpent;
    } else {
      spentHobby += pointsSpent;
    }

    // Check cap (allow final cap if occupation bonuses applied)
    const maxAllowed = character.occupationBonusesApplied ? finalSkillCap : skillCap;

    if (totalValue > maxAllowed) {
      result.errors.push(`L'abilità "${skillDisplayName}" supera il limite (${totalValue} > ${maxAllowed})`);
      result.isValid = false;
    }
  }

  // Dynamic/placeholder skills (e.g. "Lingua straniera (Italiano)") normally live ONLY
  // here, not in character.skills - see the comment above. Count them directly from
  // their own breakdown fields, skipping any already counted via the legacy name-keyed
  // path above to avoid double-counting.
  for (const dynamicEntry of character.dynamicSkills || []) {
    if (countedDynamicSkillNames.has(dynamicEntry.skillName)) continue;

    const manualPoints = dynamicEntry.manualPoints || 0;
    const requiredBonus = dynamicEntry.requiredBonus || 0;
    const pointsSpent = manualPoints + requiredBonus;
    const isOccupationSkill = isDynamicOccupationSkill(dynamicEntry, occSkillSet);

    if (isOccupationSkill) {
      spentOcc += pointsSpent;
    } else {
      spentHobby += pointsSpent;
    }

    const maxAllowed = character.occupationBonusesApplied ? finalSkillCap : skillCap;
    if (dynamicEntry.value > maxAllowed) {
      result.errors.push(`L'abilità "${dynamicEntry.skillName}" supera il limite (${dynamicEntry.value} > ${maxAllowed})`);
      result.isValid = false;
    }
  }

  // Feasibility check across the 3 pools: the flexible base pool covers whatever
  // overflows the earmarked occupation/hobby pools, but not beyond its own size.
  const overflowOcc = Math.max(0, spentOcc - skillPoints.occPool);
  const overflowHobby = Math.max(0, spentHobby - skillPoints.hobbyPool);
  const skillPointsSpent = spentOcc + spentHobby;

  if (overflowOcc + overflowHobby > skillPoints.basePool) {
    result.errors.push(
      `Punti abilità: superati i pool disponibili (Professione: ${spentOcc}/${skillPoints.occPool}, ` +
      `Hobby: ${spentHobby}/${skillPoints.hobbyPool}, Base: ${overflowOcc + overflowHobby}/${skillPoints.basePool})`
    );
    result.isValid = false;
  } else if (skillPointsSpent < skillPoints.totalAvailable) {
    result.errors.push(`Devi spendere tutti i punti abilità (spesi: ${skillPointsSpent}, disponibili: ${skillPoints.totalAvailable}, rimanenti: ${skillPoints.totalAvailable - skillPointsSpent})`);
    result.isValid = false;
  } else if (skillPointsSpent > skillPoints.totalAvailable) {
    result.errors.push(`Hai superato i punti abilità disponibili (spesi: ${skillPointsSpent}, disponibili: ${skillPoints.totalAvailable})`);
    result.isValid = false;
  }

  // Check that all required skill slots have been satisfied.
  // Each slot contains 1+ skill options (populated ObjectIds).
  // 1 option = mandatory skill; N options = player picks one.

  // Extract required minimum from config
  const requiredSkillMinimum = config.occupation.requiredSkillMinimum || 30;

  let slotsValidated = 0;
  const totalSlots = occupation.requiredSkillSlots?.length || 0;

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const slot = (occupation.requiredSkillSlots || [])[slotIdx];
    const options = slot?.options || [];
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
          (ds) => ds.basedOnTemplate === skillName
        );

        if (dynamicEntries.length > 0) {
          const resolvedBase = resolveBaseValue(skill.baseValue, character.stats as Record<string, number>);
          const hasImproved = dynamicEntries.some((ds: { value: number; skillId?: unknown }) => {
            if (ds.value >= requiredSkillMinimum) return true;
            const skillId = (ds as { skillId?: { toString(): string } }).skillId?.toString();
            if (skillId) {
              const skillData = skillsObj[skillId];
              if (skillData && typeof skillData === 'object' && 'total' in skillData) {
                return (skillData as SkillBreakdown).total >= requiredSkillMinimum;
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
              totalValue = (charSkillValue as SkillBreakdown).total;
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
          skillValue = (value as SkillBreakdown).total;
        } else if (typeof value === 'number') {
          skillValue = value;
        }
      } else {
        const value = (character.skills as Record<string, number | SkillBreakdown>)?.[skillId];
        if (typeof value === 'object' && value !== null && 'total' in value) {
          skillValue = (value as SkillBreakdown).total;
        } else if (typeof value === 'number') {
          skillValue = value;
        }
      }

      const resolvedBase = resolveBaseValue(skill.baseValue, character.stats as Record<string, number>);
      if (skillValue >= requiredSkillMinimum) {
        slotSatisfied = true;
        break;
      }
    }

    if (slotSatisfied) {
      slotsValidated++;
    } else {
      const optionNames = options.map((o: unknown) => (typeof o === 'object' && o !== null && 'name' in o ? (o as { name: string }).name : 'Sconosciuta')).join(' o ');
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

  // Required: structured background fields
  if (character.background) {
    if (!character.background.briefHistory || character.background.briefHistory.trim().length < 50) {
      backgroundErrors.push(`La storia breve deve essere di almeno 50 caratteri (attuale: ${character.background.briefHistory?.trim().length || 0})`);
    }

    if (!character.background.personality || character.background.personality.trim().length < 50) {
      backgroundErrors.push(`La descrizione della personalità deve essere di almeno 50 caratteri (attuale: ${character.background.personality?.trim().length || 0})`);
    }
  } else {
    backgroundErrors.push('Il background del personaggio deve essere completato');
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
  const occupationWithMethods = occupation as IOccupation & { checkPrerequisites?: (character: ICharacter, skills: unknown[], occupations: unknown[]) => { canAccess: boolean; issues: string[] } };
  if (typeof occupationWithMethods.checkPrerequisites === 'function') {
    return occupationWithMethods.checkPrerequisites(character, [], []);
  }

  return {
    canAccess: issues.length === 0,
    issues
  };
}
