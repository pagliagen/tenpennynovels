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

import type {
  WizardBasicInfo,
  WizardOccupation,
  WizardStats,
  WizardBackground,
  SkillBreakdown,
  DynamicSkill,
  ValidationResult,
} from '@/types/wizard';
import type { CharacterCreationConfig } from '@/lib/api/character';

export function validateStep1(basicInfo: WizardBasicInfo): ValidationResult {
  const errors: Record<string, string> = {};

  if (!basicInfo.firstName || basicInfo.firstName.length < 2) {
    errors.firstName = 'Nome deve essere almeno 2 caratteri';
  }
  if (!basicInfo.lastName || basicInfo.lastName.length < 2) {
    errors.lastName = 'Cognome deve essere almeno 2 caratteri';
  }
  if (basicInfo.age < 16 || basicInfo.age > 80) {
    errors.age = 'Età deve essere tra 16 e 80';
  }
  if (basicInfo.apparentAge < 16 || basicInfo.apparentAge > 80) {
    errors.apparentAge = 'Età apparente deve essere tra 16 e 80';
  }
  if (!basicInfo.gender) {
    errors.gender = 'Seleziona un genere';
  }
  if (!basicInfo.birthplace) {
    errors.birthplace = 'Inserisci luogo di nascita';
  }
  if (!basicInfo.height || basicInfo.height.trim() === '') {
    errors.height = 'Altezza è obbligatoria';
  } else {
    const heightNum = parseFloat(basicInfo.height);
    if (isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      errors.height = 'Altezza deve essere tra 100 e 250 cm';
    }
  }
  if (!basicInfo.weight || basicInfo.weight.trim() === '') {
    errors.weight = 'Peso è obbligatorio';
  } else {
    const weightNum = parseFloat(basicInfo.weight);
    if (isNaN(weightNum) || weightNum < 30 || weightNum > 200) {
      errors.weight = 'Peso deve essere tra 30 e 200 kg';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep2(occupation: WizardOccupation): ValidationResult {
  const errors: Record<string, string> = {};

  if (!occupation.occupationId) {
    errors.occupationId = "Seleziona un'occupazione";
  }
  if (!occupation.currentOccupation) {
    errors.currentOccupation = 'Inserisci titolo occupazione';
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
  _stats: WizardStats,
  occupation: WizardOccupation,
  dynamicSkills: DynamicSkill[],
  creationConfig?: CharacterCreationConfig | null
): ValidationResult {
  const errors: Record<string, string> = {};

  // Get config values (fallback to defaults if not provided)
  const TOTAL_SKILL_POINTS = creationConfig?.skills.totalPoints ?? 250;
  const CREATION_CAP = creationConfig?.skills.creationCap ?? 75;
  const CREATION_CAP_WITH_OCC = creationConfig?.skills.creationCapWithOccupation ?? 80;

  const totalSpent = Object.values(skills).reduce(
    (sum, skill) => sum + skill.manualPoints + skill.requiredBonus,
    0
  );

  if (totalSpent !== TOTAL_SKILL_POINTS) {
    const diff = totalSpent - TOTAL_SKILL_POINTS;
    if (diff > 0) {
      errors.skillsBudget = `Punti abilità: ${totalSpent}/${TOTAL_SKILL_POINTS} (superato di ${diff})`;
    } else {
      errors.skillsBudget = `Punti abilità: ${totalSpent}/${TOTAL_SKILL_POINTS} (mancano ${Math.abs(diff)} punti)`;
    }
  }

  for (const [skillName, skill] of Object.entries(skills)) {
    const cap = skill.occupationBonus > 0 ? CREATION_CAP_WITH_OCC : CREATION_CAP;
    if (skill.total > cap) {
      errors[`skill_${skillName}`] = `${skillName}: ${skill.total}/${cap} (cap superato)`;
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
  basicInfo: WizardBasicInfo,
  background: WizardBackground
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!basicInfo.publicDescription || basicInfo.publicDescription.trim().length < 50) {
    errors.publicDescription = 'Descrizione pubblica deve essere almeno 50 caratteri';
  }
  if (!basicInfo.privateDescription || basicInfo.privateDescription.trim().length < 50) {
    errors.privateDescription = 'Descrizione privata deve essere almeno 50 caratteri';
  }
  if (!background.briefHistory || background.briefHistory.trim().length < 100) {
    errors.briefHistory = 'Storia in breve deve essere almeno 100 caratteri';
  }
  if (!background.personality || background.personality.trim().length < 50) {
    errors.personality = 'Personalità deve essere almeno 50 caratteri';
  }
  if (!background.goalsAndMotivations || background.goalsAndMotivations.trim().length < 50) {
    errors.goalsAndMotivations = 'Obiettivi e motivazioni deve essere almeno 50 caratteri';
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
  background: WizardBackground;
}): Record<number, ValidationResult> {
  return {
    1: validateStep1(data.basicInfo),
    2: validateStep2(data.occupation),
    3: validateStep3(data.stats),
    4: validateStep4(data.skills, data.stats, data.occupation, data.dynamicSkills),
    5: validateStep5(data.basicInfo, data.background),
    6: { valid: true, errors: {} },
  };
}
