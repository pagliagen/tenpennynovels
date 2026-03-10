/**
 * Wizard Store (Zustand with localStorage persistence)
 *
 * Manages character creation wizard state:
 * - All 6 steps data (40+ fields)
 * - Step navigation
 * - Validation state
 * - Transformation for backend submission
 *
 * **Persistence**: Wizard state is auto-saved to localStorage ('wizard-draft').
 * Data persists across page refreshes, allowing users to continue mid-creation.
 * Use reset() to clear saved draft.
 *
 * **4-Level Validation**:
 * 1. Field-level (real-time, debounced)
 * 2. Step-level (on Next click)
 * 3. Cross-step (on Submit)
 * 4. Backend (on POST)
 *
 * @module store/wizardStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  WizardData,
  WizardBasicInfo,
  WizardOccupation,
  WizardStats,
  DerivedStats,
  WizardBackground,
  SkillBreakdown,
  DynamicSkill,
  ValidationResult,
  CharacterCreatePayload,
} from '@/types/wizard';

/**
 * Wizard Store State Interface
 */
interface WizardStore extends WizardData {
  // Validation state
  stepErrors: Record<number, Record<string, string>>; // Step → Field → Error
  isValidating: boolean;

  // Actions - Navigation
  setCurrentStep: (step: number) => void;
  nextStep: () => boolean; // Returns false if validation fails
  prevStep: () => void;

  // Actions - Basic Info (Step 1)
  updateBasicInfo: (field: keyof WizardBasicInfo, value: any) => void;
  setBasicInfo: (data: Partial<WizardBasicInfo>) => void;

  // Actions - Occupation (Step 2)
  updateOccupation: (data: Partial<WizardOccupation>) => void;

  // Actions - Stats (Step 3)
  updateStat: (statName: keyof WizardStats, value: number) => void;
  setStats: (stats: Partial<WizardStats>) => void;
  recalculateDerivedStats: () => void;

  // Actions - Skills (Step 4)
  updateSkill: (skillName: string, breakdown: Partial<SkillBreakdown>) => void;
  setSkillManualPoints: (skillName: string, points: number) => void;
  applyOccupationBonuses: (requiredSkills: string[], bonusSkill: string) => void;
  autoAssignRequiredSkills: (occupationData: any, skillDefinitions: any) => void;
  addDynamicSkill: (skill: DynamicSkill) => void;
  removeDynamicSkill: (skillId: string) => void;

  // Actions - Background (Step 5)
  updateBackground: (data: Partial<WizardBackground>) => void;
  setBackgroundResponse: (questionIndex: number, response: string) => void;

  // Actions - Validation
  validateStep: (step: number) => ValidationResult;
  validateAll: () => ValidationResult;
  setStepErrors: (step: number, errors: Record<string, string>) => void;
  clearStepErrors: (step: number) => void;

  // Actions - Transformation
  transformForBackend: () => CharacterCreatePayload;

  // Actions - Reset
  reset: () => void;
  loadFromDraft: (character: any) => void; // For editing DRAFT characters
}

/**
 * Initial State Factory
 */
const initialState = (): Omit<
  WizardStore,
  | 'setCurrentStep'
  | 'nextStep'
  | 'prevStep'
  | 'updateBasicInfo'
  | 'setBasicInfo'
  | 'updateOccupation'
  | 'updateStat'
  | 'setStats'
  | 'recalculateDerivedStats'
  | 'updateSkill'
  | 'setSkillManualPoints'
  | 'applyOccupationBonuses'
  | 'autoAssignRequiredSkills'
  | 'addDynamicSkill'
  | 'removeDynamicSkill'
  | 'updateBackground'
  | 'setBackgroundResponse'
  | 'validateStep'
  | 'validateAll'
  | 'setStepErrors'
  | 'clearStepErrors'
  | 'transformForBackend'
  | 'reset'
  | 'loadFromDraft'
> => ({
  // Navigation
  currentStep: 1,

  // Step 1: Basic Info
  basicInfo: {
    firstName: '',
    lastName: '',
    birthDate: '',
    birthplace: '', // lowercase (backend format)
    age: 25,
    apparentAge: 25,
    gender: '',
    height: '',
    weight: '',
    eyeColor: '',
    hairColor: '',
    visibleMarks: '',
    hiddenMarks: '',
    maritalStatus: '',
    illnesses: '',
    educationTitle: '',
    criminalRecord: '',
    // Step 5 fields (moved here for consistency with backend)
    publicDescription: '',
    privateDescription: '',
    physicalDescription: '',
  },

  // Step 2: Occupation
  occupation: {
    occupationId: '',
    currentOccupation: '',
    selectedAlternativeSkills: {},
    occupationBonusesApplied: false,
    requiredPlaceholderSkills: [],
  },

  // Step 3: Stats
  stats: {
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    constitution: 20,
    appearance: 20, // Use "appearance" not "charm"
    power: 20,
    size: 20,
    education: 20,
  },

  // Step 3: Derived Stats
  derivedStats: {
    hitPoints: 4, // FLOOR((CON + SIZ) / 10) = FLOOR((20 + 20) / 10) = 4
    sanity: 20, // POW
    maxSanity: 99, // 99 - Cthulhu Mythos (0 initially)
    magicPoints: 4, // FLOOR(POW / 5) = FLOOR(20 / 5) = 4
    luck: 20, // POW
  },

  // Step 4: Skills
  skills: {}, // Populated from config/occupations

  // Step 4: Dynamic Skills
  dynamicSkills: [],

  // Step 5: Background (structured fields matching backend schema)
  background: {
    briefHistory: '',
    significantEvents: '',
    importantRelationships: '',
    personality: '',
    ideology: '',
    significantPlaces: '',
    fearsAndPhobias: '',
    secrets: '',
    goalsAndMotivations: '',
  },

  // Validation
  stepErrors: {},
  isValidating: false,
});

/**
 * Wizard Store (Zustand)
 *
 * Centralized state management for character creation wizard.
 * Use via `useWizardStore()` hook in components.
 *
 * @example
 * ```typescript
 * import { useWizardStore } from '@/store/wizardStore';
 *
 * function Step1BasicInfo() {
 *   const { basicInfo, updateBasicInfo, nextStep } = useWizardStore();
 *
 *   return (
 *     <input
 *       value={basicInfo.firstName}
 *       onChange={(e) => updateBasicInfo('firstName', e.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export const useWizardStore = create<WizardStore>()(
  persist(
    devtools(
      (set, get) => ({
        ...initialState(),

      /**
       * Set Current Step
       *
       * Navigates to specified step (1-6).
       * Does NOT validate - use nextStep() for validated navigation.
       *
       * @param step - Step number (1-6)
       */
      setCurrentStep: (step) => {
        if (step < 1 || step > 6) {
          console.warn(`[WizardStore] Invalid step: ${step}, must be 1-6`);
          return;
        }
        set({ currentStep: step });
      },

      /**
       * Next Step (with Validation)
       *
       * Validates current step before allowing navigation.
       * Returns false if validation fails.
       *
       * @returns {boolean} True if navigation successful, false if blocked by validation
       */
      nextStep: () => {
        const { currentStep, validateStep } = get();

        // Validate current step
        const validation = validateStep(currentStep);

        if (!validation.valid) {
          // Set errors, block navigation
          set({
            stepErrors: {
              ...get().stepErrors,
              [currentStep]: validation.errors,
            },
          });
          return false;
        }

        // Clear errors, proceed
        set({
          currentStep: currentStep + 1,
          stepErrors: {
            ...get().stepErrors,
            [currentStep]: {},
          },
        });

        return true;
      },

      /**
       * Previous Step
       *
       * Navigates to previous step without validation.
       */
      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 });
        }
      },

      /**
       * Update Basic Info Field
       *
       * Updates a single field in Step 1.
       *
       * @param field - Field name
       * @param value - New value
       */
      updateBasicInfo: (field, value) => {
        set({
          basicInfo: {
            ...get().basicInfo,
            [field]: value,
          },
        });
      },

      /**
       * Set Basic Info (Batch Update)
       *
       * Updates multiple fields at once.
       *
       * @param data - Partial basic info data
       */
      setBasicInfo: (data) => {
        set({
          basicInfo: {
            ...get().basicInfo,
            ...data,
          },
        });
      },

      /**
       * Update Occupation
       *
       * Updates Step 2 occupation data.
       *
       * @param data - Partial occupation data
       */
      updateOccupation: (data) => {
        set({
          occupation: {
            ...get().occupation,
            ...data,
          },
        });
      },

      /**
       * Update Single Stat
       *
       * Updates one stat value and recalculates derived stats.
       *
       * @param statName - Stat name (strength, dexterity, etc.)
       * @param value - New value (1-100)
       */
      updateStat: (statName, value) => {
        // Clamp value to valid range
        const clampedValue = Math.max(1, Math.min(100, value));

        set({
          stats: {
            ...get().stats,
            [statName]: clampedValue,
          },
        });

        // Recalculate derived stats
        get().recalculateDerivedStats();
      },

      /**
       * Set Stats (Batch Update)
       *
       * Updates multiple stats at once.
       *
       * @param stats - Partial stats data
       */
      setStats: (stats) => {
        set({
          stats: {
            ...get().stats,
            ...stats,
          },
        });

        // Recalculate derived stats
        get().recalculateDerivedStats();
      },

      /**
       * Recalculate Derived Stats
       *
       * Calculates HP, Sanity, Magic Points, Luck from base stats.
       * Called automatically after stat updates.
       *
       * **Formulas** (from character-creation.json):
       * - HP = FLOOR((CON + SIZ) / 10)
       * - Sanity = POW
       * - Max Sanity = 99 (minus Cthulhu Mythos skill)
       * - Magic Points = FLOOR(POW / 5)
       * - Luck = POW
       */
      recalculateDerivedStats: () => {
        const { stats } = get();

        const derivedStats: DerivedStats = {
          hitPoints: Math.floor((stats.constitution + stats.size) / 10),
          sanity: stats.power,
          maxSanity: 99, // Minus Cthulhu Mythos (0 initially)
          magicPoints: Math.floor(stats.power / 5),
          luck: stats.power,
        };

        set({ derivedStats });
      },

      /**
       * Update Skill
       *
       * Updates skill breakdown (partial update).
       *
       * @param skillName - Skill name (e.g., "Accounting")
       * @param breakdown - Partial breakdown data
       */
      updateSkill: (skillName, breakdown) => {
        const { skills } = get();
        const currentSkill = skills[skillName] || {
          total: 0,
          base: 0,
          requiredBonus: 0,
          manualPoints: 0,
          occupationBonus: 0,
        };

        const updatedSkill = {
          ...currentSkill,
          ...breakdown,
        };

        // Recalculate total
        updatedSkill.total =
          updatedSkill.base +
          updatedSkill.requiredBonus +
          updatedSkill.manualPoints +
          updatedSkill.occupationBonus;

        set({
          skills: {
            ...skills,
            [skillName]: updatedSkill,
          },
        });
      },

      /**
       * Set Skill Manual Points
       *
       * Updates only manualPoints for a skill (budget enforcement).
       *
       * @param skillName - Skill name
       * @param points - Manual points to allocate
       */
      setSkillManualPoints: (skillName, points) => {
        get().updateSkill(skillName, { manualPoints: points });
      },

      /**
       * Apply Occupation Bonuses
       *
       * Applies occupation bonuses to required skills (boost to 40) and bonus skill (+30).
       *
       * **Logic**:
       * - Required skills: If current total < 40, apply requiredBonus = (40 - base)
       * - Bonus skill: Apply +30 occupationBonus (can exceed 75, up to 80)
       *
       * @param requiredSkills - Array of 6 required skill names
       * @param bonusSkill - Single bonus skill name (user-selected)
       */
      applyOccupationBonuses: (requiredSkills, bonusSkill) => {
        const { skills } = get();
        const updatedSkills = { ...skills };

        // Required skills: boost to 40 if < 40
        for (const skillName of requiredSkills) {
          if (updatedSkills[skillName]) {
            const current = updatedSkills[skillName].total;
            if (current < 40) {
              updatedSkills[skillName].requiredBonus = 40 - updatedSkills[skillName].base;
              updatedSkills[skillName].total =
                updatedSkills[skillName].base +
                updatedSkills[skillName].requiredBonus +
                updatedSkills[skillName].manualPoints +
                updatedSkills[skillName].occupationBonus;
            }
          }
        }

        // Bonus skill: +30 points
        if (updatedSkills[bonusSkill]) {
          updatedSkills[bonusSkill].occupationBonus = 30;
          updatedSkills[bonusSkill].total =
            updatedSkills[bonusSkill].base +
            updatedSkills[bonusSkill].requiredBonus +
            updatedSkills[bonusSkill].manualPoints +
            updatedSkills[bonusSkill].occupationBonus;
        }

        set({
          skills: updatedSkills,
          occupation: {
            ...get().occupation,
            occupationBonusesApplied: true,
          },
        });
      },

      /**
       * Auto-Assign Required Skills
       *
       * Automatically calculates and assigns requiredBonus for mandatory occupation skills.
       * This ensures skills reach the required minimum (default 40) without consuming user budget.
       *
       * **Key Rules**:
       * - Only processes mandatory skills (no alternatives)
       * - Uses `requiredBonus` field (NOT manualPoints)
       * - requiredBonus = max(0, requiredMinimum - skill.base)
       * - Does NOT count toward 200-point budget
       * - Preserves existing manualPoints if user already allocated
       * - Respects 75/80 cap (80 if occupationBonus > 0)
       *
       * @param occupationData - Occupation from API (includes requiredSkills)
       * @param skillDefinitions - All skills from API (to get base values)
       */
      autoAssignRequiredSkills: (occupationData, skillDefinitions) => {
        if (!occupationData?.requiredSkills || !skillDefinitions?.length) {
          console.warn('[wizardStore] Cannot auto-assign: missing occupation or skill data');
          return;
        }

        const { skills } = get();
        const updatedSkills = { ...skills };
        let changesMade = false;

        // Track placeholder skills for validation
        const requiredPlaceholderSkills: string[] = [];

        // FIRST: Clear old requiredBonus when occupation changes
        Object.keys(updatedSkills).forEach((skillId) => {
          const skill = updatedSkills[skillId];
          if (skill && skill.requiredBonus > 0) {
            skill.requiredBonus = 0;
            skill.total = skill.base + skill.manualPoints + skill.occupationBonus;
            changesMade = true;
          }
        });

        // SECOND: Process each required skill
        occupationData.requiredSkills.forEach((requirement: any) => {
          // Skip skills with alternatives (user must choose)
          if (requirement.alternatives && requirement.alternatives.length > 0) {
            return;
          }

          // Find skill definition to get base value (case-insensitive match)
          const skillDef = skillDefinitions.find(
            (s: any) =>
              s.id === requirement.skillId ||
              s.name.toLowerCase() === requirement.name.toLowerCase()
          );

          if (!skillDef) {
            console.warn(`[wizardStore] Skill not found: ${requirement.name}`);
            return;
          }

          // If placeholder, track it for validation and skip auto-assignment
          // User must add specializations via PlaceholderSkillManager and select primary
          if (skillDef.isPlaceholder) {
            requiredPlaceholderSkills.push(skillDef.name);
            console.log(`[wizardStore] Tracked required placeholder: ${skillDef.name}`);
            return;
          }

          // Get or initialize skill breakdown
          const currentSkill = updatedSkills[skillDef.id] || {
            base: skillDef.baseValue,
            requiredBonus: 0,
            manualPoints: 0,
            occupationBonus: 0,
            total: skillDef.baseValue,
            category: skillDef.category,
          };

          // Calculate required bonus (default minimum is 40)
          const requiredMinimum = requirement.bonusValue || 40;
          const newRequiredBonus = Math.max(0, requiredMinimum - currentSkill.base);

          // Only update if changed
          if (currentSkill.requiredBonus !== newRequiredBonus) {
            currentSkill.requiredBonus = newRequiredBonus;

            // Recalculate total
            currentSkill.total =
              currentSkill.base +
              currentSkill.requiredBonus +
              currentSkill.manualPoints +
              currentSkill.occupationBonus;

            // Enforce cap (75 normally, 80 with occupation bonus)
            const cap = currentSkill.occupationBonus > 0 ? 80 : 75;
            if (currentSkill.total > cap) {
              // Reduce manualPoints to fit cap (preserve requiredBonus)
              const excess = currentSkill.total - cap;
              currentSkill.manualPoints = Math.max(0, currentSkill.manualPoints - excess);
              currentSkill.total = cap;
              console.warn(
                `[wizardStore] Skill ${skillDef.name} exceeded cap, reduced manualPoints`
              );
            }

            updatedSkills[skillDef.id] = currentSkill;
            changesMade = true;
          }
        });

        // THIRD: Clear old occupation bonuses
        Object.keys(updatedSkills).forEach((skillId) => {
          const skill = updatedSkills[skillId];
          if (skill && skill.occupationBonus > 0) {
            skill.occupationBonus = 0;
            skill.total = skill.base + skill.requiredBonus + skill.manualPoints;
            changesMade = true;
          }
        });

        // FOURTH: Process bonus skills (user doesn't choose - automatically applied)
        if (occupationData.bonusSkills && occupationData.bonusSkills.length > 0) {
          occupationData.bonusSkills.forEach((bonusSkill: any) => {
            // Find skill definition (case-insensitive match)
            const skillDef = skillDefinitions.find(
              (s: any) =>
                s.id === bonusSkill.skillId ||
                s.name.toLowerCase() === bonusSkill.name.toLowerCase()
            );

            if (!skillDef) {
              console.warn(`[wizardStore] Bonus skill not found: ${bonusSkill.name}`);
              return;
            }

            // Get or initialize skill breakdown
            const currentSkill = updatedSkills[skillDef.id] || {
              base: skillDef.baseValue,
              requiredBonus: 0,
              manualPoints: 0,
              occupationBonus: 0,
              total: skillDef.baseValue,
              category: skillDef.category,
            };

            // Apply occupation bonus (from CSV, e.g., +30 or +10)
            const bonusValue = bonusSkill.bonusValue || 30;
            currentSkill.occupationBonus = bonusValue;

            // Recalculate total
            currentSkill.total =
              currentSkill.base +
              currentSkill.requiredBonus +
              currentSkill.manualPoints +
              currentSkill.occupationBonus;

            // Enforce cap (80 with occupation bonus)
            const cap = 80;
            if (currentSkill.total > cap) {
              const excess = currentSkill.total - cap;
              currentSkill.manualPoints = Math.max(0, currentSkill.manualPoints - excess);
              currentSkill.total = cap;
            }

            updatedSkills[skillDef.id] = currentSkill;
            changesMade = true;
          });
        }

        // Update state (skills + required placeholder tracking + flag)
        const updates: any = {
          occupation: {
            ...get().occupation,
            requiredPlaceholderSkills,
            occupationBonusesApplied: true, // Mark as applied after auto-assignment
          },
        };

        if (changesMade) {
          updates.skills = updatedSkills;
        }

        set(updates);
        console.log(
          `[wizardStore] Auto-assigned required skills. Placeholders tracked: [${requiredPlaceholderSkills.join(', ')}]`
        );
      },

      /**
       * Add Dynamic Skill
       *
       * Adds a specialization skill (Art: Painting, Science: Chemistry, etc.).
       *
       * @param skill - Dynamic skill entry
       */
      addDynamicSkill: (skill) => {
        const { dynamicSkills } = get();

        // Check if already exists
        if (dynamicSkills.some((s) => s.skillId === skill.skillId)) {
          console.warn(`[WizardStore] Skill already exists: ${skill.skillId}`);
          return;
        }

        set({
          dynamicSkills: [...dynamicSkills, skill],
        });
      },

      /**
       * Remove Dynamic Skill
       *
       * Removes a specialization skill.
       *
       * @param skillId - Skill ID to remove
       */
      removeDynamicSkill: (skillId) => {
        set({
          dynamicSkills: get().dynamicSkills.filter((s) => s.skillId !== skillId),
        });
      },

      /**
       * Update Background
       *
       * Updates Step 5 background data.
       *
       * @param data - Partial background data
       */
      updateBackground: (data) => {
        set({
          background: {
            ...get().background,
            ...data,
          },
        });
      },

      /**
       * Set Background Response
       *
       * Updates a single background question response.
       *
       * @param questionIndex - Question index (0-8)
       * @param response - Response text
       */
      setBackgroundResponse: (questionIndex, response) => {
        const { background } = get();
        const updatedResponses = [...(background.backgroundResponses || [])];
        updatedResponses[questionIndex] = {
          question: updatedResponses[questionIndex]?.question || '',
          response,
        };

        set({
          background: {
            ...background,
            backgroundResponses: updatedResponses,
          },
        });
      },

      validateStep: (step) => {
        const state = get();
        const validators: Record<number, () => import('@/types/wizard').ValidationResult> = {
          1: () => require('@/components/character/wizard/validation/wizardValidation').validateStep1(state.basicInfo),
          2: () => require('@/components/character/wizard/validation/wizardValidation').validateStep2(state.occupation),
          3: () => require('@/components/character/wizard/validation/wizardValidation').validateStep3(state.stats),
          4: () => require('@/components/character/wizard/validation/wizardValidation').validateStep4(state.skills, state.stats, state.occupation, state.dynamicSkills),
          5: () => require('@/components/character/wizard/validation/wizardValidation').validateStep5(state.basicInfo, state.background),
          6: () => ({ valid: true, errors: {} }),
        };
        const validator = validators[step];
        return validator ? validator() : { valid: true, errors: {} };
      },

      validateAll: () => {
        const errors: Record<string, string> = {};
        for (let step = 1; step <= 5; step++) {
          const stepResult = get().validateStep(step);
          if (!stepResult.valid) {
            errors[`step${step}`] = `Step ${step} ha errori`;
          }
        }
        const { occupation } = get();
        if (occupation.occupationBonusesApplied === false) {
          errors.occupationBonuses = "Devi applicare i bonus dell'occupazione (Step 4)";
        }
        return { valid: Object.keys(errors).length === 0, errors };
      },

      /**
       * Set Step Errors
       *
       * Manually set errors for a step (e.g., from backend validation).
       *
       * @param step - Step number
       * @param errors - Error map
       */
      setStepErrors: (step, errors) => {
        set({
          stepErrors: {
            ...get().stepErrors,
            [step]: errors,
          },
        });
      },

      /**
       * Clear Step Errors
       *
       * Clears all errors for a step.
       *
       * @param step - Step number
       */
      clearStepErrors: (step) => {
        set({
          stepErrors: {
            ...get().stepErrors,
            [step]: {},
          },
        });
      },

      /**
       * Transform for Backend
       *
       * Transforms wizardStore state to backend CharacterCreatePayload format.
       * Handles field name reconciliation and skills mapping.
       *
       * **Field Mapping**:
       * - firstName + lastName → name
       * - birthPlace → birthplace (lowercase)
       * - charm → appearance
       * - SkillBreakdown → VictorianSkills (83 static fields)
       *
       * @returns CharacterCreatePayload ready for POST /game/characters
       */
      transformForBackend: () => {
        const { basicInfo, occupation, stats, derivedStats, skills, background } = get();

        // Transform skills - preserve ObjectId keys and send full SkillBreakdown
        // Backend expects: { "skillId": SkillBreakdown } or { "skillId": number }
        const transformedSkills: Record<string, any> = {};
        for (const [skillId, breakdown] of Object.entries(skills)) {
          // Skills are keyed by ObjectId - pass AS-IS (no conversion!)
          // Send full breakdown if available, otherwise just the number
          if (typeof breakdown === 'object' && breakdown.total !== undefined) {
            transformedSkills[skillId] = breakdown; // Send full SkillBreakdown
          } else {
            transformedSkills[skillId] = breakdown; // Send as number (legacy)
          }
        }

        const payload: CharacterCreatePayload = {
          // Basic info (field name reconciliation as per CharacterCreatePayload type)
          name: basicInfo.firstName + ' ' + basicInfo.lastName,
          birthplace: basicInfo.birthplace, // lowercase!
          age: basicInfo.age,
          apparentAge: basicInfo.apparentAge,
          gender: basicInfo.gender,
          height: basicInfo.height,
          weight: basicInfo.weight,
          eyeColor: basicInfo.eyeColor,
          hairColor: basicInfo.hairColor,
          visibleMarks: basicInfo.visibleMarks,
          hiddenMarks: basicInfo.hiddenMarks,
          maritalStatus: basicInfo.maritalStatus,
          illnesses: basicInfo.illnesses,
          educationTitle: basicInfo.educationTitle,
          criminalRecord: basicInfo.criminalRecord,

          // Occupation
          occupation: occupation.occupationId,
          currentOccupation: occupation.currentOccupation,

          // Stats (backend uses "appearance" not "charm" - see CharacterCreatePayload type)
          stats: {
            strength: stats.strength,
            dexterity: stats.dexterity,
            intelligence: stats.intelligence,
            constitution: stats.constitution,
            appearance: stats.appearance,
            power: stats.power,
            size: stats.size,
            education: stats.education,
            sanity: derivedStats.sanity,
            maxSanity: derivedStats.maxSanity,
            hitPoints: derivedStats.hitPoints,
            magicPoints: derivedStats.magicPoints,
            luck: derivedStats.luck,
          },

          // Skills (transformed)
          skills: transformedSkills,

          // Description fields (from Step 5)
          publicDescription: basicInfo.publicDescription,
          privateDescription: basicInfo.privateDescription,
          physicalDescription: basicInfo.physicalDescription,

          background: {
            briefHistory: background.briefHistory,
            significantEvents: background.significantEvents,
            importantRelationships: background.importantRelationships,
            personality: background.personality,
            ideology: background.ideology,
            significantPlaces: background.significantPlaces,
            fearsAndPhobias: background.fearsAndPhobias,
            secrets: background.secrets,
            goalsAndMotivations: background.goalsAndMotivations,
          },

          // Metadata
          status: 'DRAFT',
        };

        return payload;
      },

      /**
       * Reset Store
       *
       * Resets wizard to initial state.
       * Call when user cancels or completes wizard.
       */
      reset: () => {
        set(initialState());
      },

      /**
       * Load from Draft
       *
       * Loads existing DRAFT character data into wizard for editing.
       *
       * @param character - Existing character data
       */
      loadFromDraft: (character) => {
        console.log('[WizardStore] Loading DRAFT character into wizard:', character._id);

        // CLEANUP: Remove any legacy skills (name-based) from store before loading
        const currentSkills = get().skills;
        const cleanedSkills: Record<string, any> = {};
        Object.entries(currentSkills).forEach(([key, value]) => {
          // Keep only skills with valid ObjectId keys
          if (key.match(/^[0-9a-f]{24}$/i)) {
            cleanedSkills[key] = value;
          }
        });
        if (Object.keys(cleanedSkills).length !== Object.keys(currentSkills).length) {
          console.log('[WizardStore] Cleaned up legacy skills from localStorage');
          set({ skills: cleanedSkills });
        }

        // Basic Info
        set({
          basicInfo: {
            firstName: character.name || '',
            lastName: character.surname || '',
            birthDate: character.birthDate || '',
            birthplace: character.birthPlace || '',
            age: character.age || 25,
            apparentAge: character.apparentAge || 25,
            gender: character.gender || '',
            height: character.height || '',
            weight: character.weight || '',
            eyeColor: character.eyeColor || '',
            hairColor: character.hairColor || '',
            visibleMarks: character.visibleMarks || '',
            hiddenMarks: character.hiddenMarks || '',
            maritalStatus: character.maritalStatus || '',
            illnesses: character.illnesses || '',
            educationTitle: character.educationTitle || '',
            criminalRecord: character.criminalRecord || '',
            publicDescription: character.publicDescription || '',
            privateDescription: character.privateDescription || '',
            physicalDescription: character.physicalDescription || '',
          },
        });

        // Occupation
        set({
          occupation: {
            occupationId: character.occupation || '',
            currentOccupation: character.currentOccupation || '',
            selectedAlternativeSkills: {},
            occupationBonusesApplied: false,
            requiredPlaceholderSkills: [],
          },
        });

        // Stats (map charm → appearance from backend)
        if (character.stats) {
          set({
            stats: {
              strength: character.stats.strength || 20,
              dexterity: character.stats.dexterity || 20,
              intelligence: character.stats.intelligence || 20,
              constitution: character.stats.constitution || 20,
              appearance: character.stats.charm || 20, // Backend has "charm" not "appearance"
              power: character.stats.power || 20,
              size: character.stats.size || 20,
              education: character.stats.education || 20,
            },
          });
        }

        // Derived Stats
        if (character.stats) {
          set({
            derivedStats: {
              hitPoints: character.stats.hitPoints || 4,
              sanity: character.stats.sanity || 20,
              maxSanity: character.stats.maxSanity || 99,
              magicPoints: character.stats.magicPoints || 4,
              luck: character.stats.luck || 20,
            },
          });
        }

        // Skills - Preserve SkillBreakdown format from backend
        if (character.skills) {
          const skillsObj: Record<string, any> = {};

          // Handle both Map and object formats
          if (character.skills instanceof Map) {
            character.skills.forEach((value: any, key: string) => {
              // Only add skills with valid IDs (ObjectId format), skip legacy name-based skills
              if (key.match(/^[0-9a-f]{24}$/i)) {
                if (typeof value === 'number') {
                  // Legacy number format - convert to SkillBreakdown
                  skillsObj[key] = {
                    total: value,
                    base: 0,
                    requiredBonus: 0,
                    manualPoints: value,
                    occupationBonus: 0,
                    category: 'general',
                  };
                } else if (value && typeof value === 'object') {
                  // Already SkillBreakdown - preserve it completely
                  skillsObj[key] = value;
                }
              }
            });
          } else if (typeof character.skills === 'object') {
            Object.entries(character.skills).forEach(([key, value]: [string, any]) => {
              // Only add skills with valid IDs (ObjectId format), skip legacy name-based skills
              if (key.match(/^[0-9a-f]{24}$/i)) {
                if (typeof value === 'number') {
                  // Legacy number format - convert to SkillBreakdown
                  skillsObj[key] = {
                    total: value,
                    base: 0,
                    requiredBonus: 0,
                    manualPoints: value,
                    occupationBonus: 0,
                    category: 'general',
                  };
                } else if (value && typeof value === 'object') {
                  // Already SkillBreakdown - preserve it completely
                  skillsObj[key] = value;
                }
              }
            });
          }

          set({ skills: skillsObj });
        }

        // Background
        if (character.background) {
          set({
            background: {
              briefHistory: character.background.briefHistory || '',
              significantEvents: character.background.significantEvents || '',
              importantRelationships: character.background.importantRelationships || '',
              personality: character.background.personality || '',
              ideology: character.background.ideology || '',
              significantPlaces: character.background.significantPlaces || '',
              fearsAndPhobias: character.background.fearsAndPhobias || '',
              secrets: character.background.secrets || '',
              goalsAndMotivations: character.background.goalsAndMotivations || '',
            },
          });
        }

        console.log('[WizardStore] Character data loaded successfully');
      },
    }),
      { name: 'WizardStore' }
    ),
    {
      name: 'wizard-draft', // LocalStorage key
      partialize: (state) => ({
        currentStep: state.currentStep,
        basicInfo: state.basicInfo,
        occupation: state.occupation,
        stats: state.stats,
        derivedStats: state.derivedStats,
        skills: state.skills,
        dynamicSkills: state.dynamicSkills,
        background: state.background,
        // Don't persist errors/validation state
      }),
    }
  )
);
