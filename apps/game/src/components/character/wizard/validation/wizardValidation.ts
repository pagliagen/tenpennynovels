/**
 * Wizard Validation - Pure Functions
 *
 * Extracted from wizardStore for testability and reuse.
 * Each step has its own validator that takes data and returns errors.
 * Used by wizardStore (on nextStep) and WizardTabBar (on mount/refresh).
 *
 * @module components/character/wizard/validation/wizardValidation
 * @since 2.1.0
 */

import type { CharacterCreationConfig } from '@/lib/api/character';
import { computeSkillPools, computeSkillPoolUsage } from '@/lib/utils/skillPools';
import type {
  WizardBasicInfo,
  WizardOccupation,
  WizardStats,
  WizardBackground,
  SkillBreakdown,
  DynamicSkill,
  ValidationResult,
} from '@/types/wizard';

export function validateStep1(
  basicInfo: WizardBasicInfo,
  occupation: WizardOccupation,
  creationConfig?: CharacterCreationConfig | null
): ValidationResult {
  const errors: Record<string, string> = {};

  const ageMin = creationConfig?.limits.age.min ?? 16;
  const ageMax = creationConfig?.limits.age.max ?? 80;
  const heightMin = creationConfig?.limits.height.min ?? 100;
  const heightMax = creationConfig?.limits.height.max ?? 250;
  const weightMin = creationConfig?.limits.weight.min ?? 30;
  const weightMax = creationConfig?.limits.weight.max ?? 200;
  const weightUnit = creationConfig?.limits.weight.unit ?? 'kg';
  const heightUnit = creationConfig?.limits.height.unit ?? 'cm';

  if (!basicInfo.firstName || basicInfo.firstName.length < 2) {
    errors.firstName = 'Nome deve essere almeno 2 caratteri';
  }
  if (!basicInfo.lastName || basicInfo.lastName.length < 2) {
    errors.lastName = 'Cognome deve essere almeno 2 caratteri';
  }
  if (basicInfo.age < ageMin || basicInfo.age > ageMax) {
    errors.age = `Età deve essere tra ${ageMin} e ${ageMax}`;
  }
  if (basicInfo.apparentAge < ageMin || basicInfo.apparentAge > ageMax) {
    errors.apparentAge = `Età apparente deve essere tra ${ageMin} e ${ageMax}`;
  }
  if (!basicInfo.gender) {
    errors.gender = 'Seleziona un genere';
  }
  if (!basicInfo.height || basicInfo.height.trim() === '') {
    errors.height = 'Altezza è obbligatoria';
  } else {
    const heightNum = parseFloat(basicInfo.height);
    if (isNaN(heightNum) || heightNum < heightMin || heightNum > heightMax) {
      errors.height = `Altezza deve essere tra ${heightMin} e ${heightMax} ${heightUnit}`;
    }
  }
  if (!basicInfo.weight || basicInfo.weight.trim() === '') {
    errors.weight = 'Peso è obbligatorio';
  } else {
    const weightNum = parseFloat(basicInfo.weight);
    if (isNaN(weightNum) || weightNum < weightMin || weightNum > weightMax) {
      errors.weight = `Peso deve essere tra ${weightMin} e ${weightMax} ${weightUnit}`;
    }
  }
  if (!occupation.currentOccupation || occupation.currentOccupation.trim() === '') {
    errors.currentOccupation = 'Occupazione attuale è obbligatoria';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep2(occupation: WizardOccupation): ValidationResult {
  const errors: Record<string, string> = {};

  if (!occupation.occupationId) {
    errors.occupationId = "Seleziona un'occupazione";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep3(stats: WizardStats, creationConfig?: CharacterCreationConfig | null): ValidationResult {
  const errors: Record<string, string> = {};

  // Get config values (fallback to defaults if not provided)
  const TOTAL_POINTS = creationConfig?.stats.totalPoints ?? 450;
  const MIN_VALUE = creationConfig?.stats.minValue ?? 20;
  const MAX_ABOVE_80 = creationConfig?.stats.maxStatsAbove80 ?? 2;
  const CREATION_CAP = creationConfig?.stats.creationCap ?? 85;

  // Type assertion safe: WizardStats declared properties are all number
  const statValues = Object.values(stats) as number[];
  const total = statValues.reduce((sum, val) => sum + val, 0);
  const above80 = statValues.filter((val) => val > 80).length;

  if (total !== TOTAL_POINTS) {
    errors.statsBudget = `Budget stats: ${total}/${TOTAL_POINTS} (deve essere esattamente ${TOTAL_POINTS})`;
  }
  if (above80 > MAX_ABOVE_80) {
    errors.statsAbove80 = `Massimo ${MAX_ABOVE_80} stats sopra 80 (attualmente: ${above80})`;
  }
  if (statValues.some((val) => val > CREATION_CAP)) {
    errors.statsCap = `Nessun stat può superare ${CREATION_CAP} in creazione`;
  }
  const belowMin = (Object.entries(stats) as [string, number][])
    .filter(([_, val]) => val < MIN_VALUE)
    .map(([key, val]) => `${key}: ${val}`);
  if (belowMin.length > 0) {
    errors.statsMinimum = `Tutte le statistiche devono essere almeno ${MIN_VALUE} (sotto minimo: ${belowMin.join(', ')})`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep4(
  skills: Record<string, SkillBreakdown>,
  stats: WizardStats,
  occupation: WizardOccupation,
  dynamicSkills: DynamicSkill[],
  creationConfig?: CharacterCreationConfig | null,
  baseClaimedByOcc = 0,
  baseClaimedByHobby = 0
): ValidationResult {
  const errors: Record<string, string> = {};

  // Get config values (fallback to defaults if not provided)
  const CREATION_CAP = creationConfig?.skills.creationCap ?? 75;
  const CREATION_CAP_WITH_OCC = creationConfig?.skills.creationCapWithOccupation ?? 80;

  const pools = computeSkillPools(stats, creationConfig);
  const usage = computeSkillPoolUsage(skills, dynamicSkills, occupation, pools, baseClaimedByOcc, baseClaimedByHobby);
  const totalSpent = usage.totalSpent;

  if (usage.overflowOcc > 0 || usage.overflowHobby > 0) {
    errors.skillsBudget =
      `Punti abilità: superati i pool disponibili ` +
      `(Professione: ${usage.spentOcc}/${pools.occPool}, Hobby: ${usage.spentHobby}/${pools.hobbyPool}, ` +
      `Base: ${usage.baseUsed}/${pools.basePool})`;
  } else if (totalSpent !== pools.totalPool) {
    const diff = totalSpent - pools.totalPool;
    errors.skillsBudget = diff > 0
      ? `Punti abilità: ${totalSpent}/${pools.totalPool} (superato di ${diff})`
      : `Punti abilità: ${totalSpent}/${pools.totalPool} (mancano ${Math.abs(diff)} punti)`;
  }

  for (const [skillName, skill] of Object.entries(skills)) {
    const cap = skill.occupationBonus > 0 ? CREATION_CAP_WITH_OCC : CREATION_CAP;
    if (skill.total > cap) {
      errors[`skill_${skillName}`] = `${skillName}: ${skill.total}/${cap} (cap superato)`;
    }
    if (skill.manualPoints < 0) {
      const floor = skill.base + skill.requiredBonus + skill.occupationBonus;
      errors[`skill_${skillName}_min`] = `${skillName}: il totale non può scendere sotto ${floor}`;
    }
  }

  if (occupation.requiredPlaceholderSkills?.length > 0) {
    occupation.requiredPlaceholderSkills.forEach((placeholderName) => {
      const derivedSkillsForPlaceholder = dynamicSkills.filter((ds) => ds.name === placeholderName);

      if (derivedSkillsForPlaceholder.length === 0) {
        errors[`placeholder_${placeholderName}`] = `"${placeholderName}": aggiungi almeno una specializzazione`;
        return;
      }

      const hasPrimary = derivedSkillsForPlaceholder.some((ds) => {
        const skill = skills[ds.skillId];
        return skill && skill.requiredBonus > 0;
      });

      if (!hasPrimary) {
        errors[`placeholder_${placeholderName}`] = `"${placeholderName}": seleziona una specializzazione come principale`;
      }
    });
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep5(
  background: WizardBackground,
  creationConfig?: CharacterCreationConfig | null
): ValidationResult {
  const errors: Record<string, string> = {};

  const bgFields = creationConfig?.limits.backgroundFields;

  const briefHistoryMin = bgFields?.briefHistory?.minChar ?? 50;
  const briefHistoryMax = bgFields?.briefHistory?.maxChar ?? 4000;
  const significantEventsMax = bgFields?.significantEvents?.maxChar ?? 2500;
  const importantRelationshipsMax = bgFields?.importantRelationships?.maxChar ?? 2500;
  const personalityMin = bgFields?.personality?.minChar ?? 50;
  const personalityMax = bgFields?.personality?.maxChar ?? 2500;
  const ideologyMax = bgFields?.ideology?.maxChar ?? 2500;

  if (briefHistoryMin > 0 && (!background.briefHistory || background.briefHistory.length < briefHistoryMin)) {
    errors.briefHistory = `Storia in breve deve essere almeno ${briefHistoryMin} caratteri`;
  }
  if (background.briefHistory && background.briefHistory.length > briefHistoryMax) {
    errors.briefHistory = `Storia in breve non può superare ${briefHistoryMax} caratteri`;
  }
  if (background.significantEvents && background.significantEvents.length > significantEventsMax) {
    errors.significantEvents = `Fatti salienti non può superare ${significantEventsMax} caratteri`;
  }
  if (background.importantRelationships && background.importantRelationships.length > importantRelationshipsMax) {
    errors.importantRelationships = `Relazioni importanti non può superare ${importantRelationshipsMax} caratteri`;
  }
  if (personalityMin > 0 && background.personality && background.personality.length < personalityMin) {
    errors.personality = `Personalità deve essere almeno ${personalityMin} caratteri`;
  }
  if (background.personality && background.personality.length > personalityMax) {
    errors.personality = `Personalità non può superare ${personalityMax} caratteri`;
  }
  if (background.ideology && background.ideology.length > ideologyMax) {
    errors.ideology = `Ideologia/Credo non può superare ${ideologyMax} caratteri`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate all steps at once. Returns a map of step number to validation result.
 * Used by WizardTabBar on mount to show X/checkmark for each tab.
 */
export function validateAllSteps(data: {
  basicInfo: WizardBasicInfo;
  occupation: WizardOccupation;
  stats: WizardStats;
  skills: Record<string, SkillBreakdown>;
  dynamicSkills: DynamicSkill[];
  baseClaimedByOcc?: number;
  baseClaimedByHobby?: number;
  background: WizardBackground;
  creationConfig?: CharacterCreationConfig | null;
}): Record<number, ValidationResult> {
  const step1 = validateStep1(data.basicInfo, data.occupation, data.creationConfig);
  const step2 = validateStep2(data.occupation);
  const step3 = validateStep3(data.stats, data.creationConfig);
  const step4 = validateStep4(data.skills, data.stats, data.occupation, data.dynamicSkills, data.creationConfig, data.baseClaimedByOcc, data.baseClaimedByHobby);
  const step5 = validateStep5(data.background, data.creationConfig);
  const allValid = step1.valid && step2.valid && step3.valid && step4.valid && step5.valid;

  return {
    1: step1,
    2: step2,
    3: step3,
    4: step4,
    5: step5,
    6: { valid: allValid, errors: {} },
  };
}
