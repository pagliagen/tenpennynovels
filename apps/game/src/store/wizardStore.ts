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

import type { CharacterCreationConfig } from '@/lib/api/character';
import { characterApi } from '@/lib/api/character';
import type { DamageBonusEntry } from '@/lib/api/gameConfig';
import { gameConfigApi } from '@/lib/api/gameConfig';
import { logger } from '@/lib/logger';
import { computeInitialBaseClaims, computeSkillPools, isOccupationSkill, sumSkillSpend } from '@/lib/utils/skillPools';
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

const FORMULA_STAT_MAP: Record<string, string> = {
  str: 'strength', dex: 'dexterity', int: 'intelligence',
  con: 'constitution', app: 'appearance', pow: 'power',
  siz: 'size', edu: 'education',
};

/**
 * Resolve a skill's baseValue from a formula string or number.
 * Skills with "FORMULA:DEX" need the character's stats to compute their base.
 */
export function resolveSkillBaseValue(
  baseFormula: string | null | undefined,
  baseValue: number,
  stats: Record<string, number | undefined>,
): number {
  if (!baseFormula) return baseValue;

  if (baseFormula.startsWith('FORMULA:')) {
    const raw = baseFormula.replace('FORMULA:', '').toLowerCase();
    const fullStat = FORMULA_STAT_MAP[raw] || raw;
    return stats[fullStat] ?? stats[raw] ?? baseValue;
  }

  return baseValue;
}

/**
 * Bonus Danno lookup table (FOR + TAG).
 * Uses the DB-driven table when available, otherwise falls back to hardcoded values.
 */
function getBonusDamage(forPlusTag: number, table?: DamageBonusEntry[] | null): string {
  if (table && table.length > 0) {
    const entry = table.find((e) => forPlusTag >= e.min && forPlusTag <= e.max);
    if (entry) return entry.bonus;
  }

  if (forPlusTag <= 64) return '-2';
  if (forPlusTag <= 84) return '-1';
  if (forPlusTag <= 124) return '0';
  if (forPlusTag <= 164) return '+1d4';
  if (forPlusTag <= 204) return '+1d6';
  if (forPlusTag <= 284) return '+2d6';
  if (forPlusTag <= 364) return '+3d6';
  if (forPlusTag <= 444) return '+4d6';
  return '+5d6';
}

/**
 * Wizard Store State Interface
 */
interface WizardStore extends WizardData {
  // Hydration & draft tracking (NOT persisted: _hasHydrated; persisted: _draftCharacterId, _serverUpdatedAt)
  _hasHydrated: boolean;
  _draftCharacterId: string | null;
  _serverUpdatedAt: string | null;

  // Cached bonus damage table from DB (NOT persisted)
  _bonusDamageTable: DamageBonusEntry[] | null;
  _bonusDamageTableLoading: boolean;

  // Character creation config (loaded from backend, NOT persisted)
  creationConfig: CharacterCreationConfig | null;
  loadCreationConfig: () => Promise<void>;

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
  fetchBonusDamageTable: () => Promise<void>;

  // Actions - Skills (Step 4)
  updateSkill: (skillName: string, breakdown: Partial<SkillBreakdown>) => void;
  setSkillManualPoints: (skillName: string, points: number) => void;
  applyOccupationBonuses: (requiredSkillIds: string[], bonusSkillId: string) => void;
  autoAssignRequiredSkills: (occupationData: any, skillDefinitions: any) => void;
  addDynamicSkill: (skill: DynamicSkill) => void;
  removeDynamicSkill: (skillId: string) => void;

  // Actions - Background (Step 5)
  updateBackground: (data: Partial<WizardBackground>) => void;

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
  | 'fetchBonusDamageTable'
  | 'loadCreationConfig'
  | 'updateSkill'
  | 'setSkillManualPoints'
  | 'applyOccupationBonuses'
  | 'autoAssignRequiredSkills'
  | 'addDynamicSkill'
  | 'removeDynamicSkill'
  | 'updateBackground'
  | 'validateAll'
  | 'validateStep'
  | 'validateAll'
  | 'setStepErrors'
  | 'clearStepErrors'
  | 'transformForBackend'
  | 'reset'
  | 'loadFromDraft'
> => ({
  // Hydration & draft tracking
  _hasHydrated: false,
  _draftCharacterId: null,
  _serverUpdatedAt: null as string | null,

  // Cached bonus damage table (NOT persisted — fetched on demand)
  _bonusDamageTable: null as DamageBonusEntry[] | null,
  _bonusDamageTableLoading: false,

  // Character creation config (NOT persisted — fetched on demand)
  creationConfig: null as CharacterCreationConfig | null,

  // Navigation
  currentStep: 1,

  // Step 1: Basic Info
  basicInfo: {
    firstName: '',
    lastName: '',
    birthDate: '',
    birthPlace: '', // matches ICharacter.birthPlace
    age: 25,
    apparentAge: 25,
    gender: '' as 'male' | 'female' | '',
    height: '',
    weight: '',
    eyeColor: '',
    hairColor: '',
    visibleMarks: '',
    hiddenMarks: '',
    prestavolto: '',
    maritalStatus: '',
    illnesses: '',
    educationTitle: '',
    criminalRecord: '',
    // Private health info (PRIVATE - owner/master only)
    pathologies: '',
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
    occupationSkillIds: [],
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
    hitPoints: 4,       // PV = FLOOR((COS + TAG) / 10) = FLOOR((20 + 20) / 10) = 4
    sanity: 20,         // SAN = POT
    maxSanity: 99,
    bonusDamage: '-2',  // BD = lookup(FOR + TAG) = lookup(40) = -2
    ideaRoll: 20,       // Tiro Idea = INT
  },

  // Step 4: Skills
  skills: {}, // Populated from config/occupations

  // Step 4: Dynamic Skills
  dynamicSkills: [],

  // Step 4: base pool (200pt) claim tracking - see WizardData doc
  baseClaimedByOcc: 0,
  baseClaimedByHobby: 0,

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
  devtools(
    persist(
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
          logger.warn(`[WizardStore] Invalid step: ${step}, must be 1-6`);
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
       * Updates one stat value and recalculates derived stats. Nessun clamp sul
       * range qui: il giocatore deve poter digitare liberamente (es. "3" mentre
       * scrive "35"), la validazione di min/max/budget avviene solo allo step
       * change (validateStep3, vedi wizardValidation.ts).
       *
       * @param statName - Stat name (strength, dexterity, etc.)
       * @param value - New value
       */
      updateStat: (statName, value) => {
        set({
          stats: {
            ...get().stats,
            [statName]: value,
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
       * Calculates PV, SAN, BD, Idea from base stats.
       * Called automatically after stat updates.
       *
       * **Formulas**:
       * - PV (Punti Vita) = FLOOR((COS + TAG) / 10)
       * - SAN (Sanita Mentale) = POT
       * - Max Sanity = 99
       * - BD (Bonus Danno) = lookup(FOR + TAG)
       * - Tiro Idea = INT
       */
      recalculateDerivedStats: () => {
        const { stats, _bonusDamageTable, _bonusDamageTableLoading } = get();

        // Lazy-load the bonus damage table if not yet fetched
        if (!_bonusDamageTable && !_bonusDamageTableLoading) {
          get().fetchBonusDamageTable();
        }

        const derivedStats: DerivedStats = {
          hitPoints: Math.floor((stats.constitution + stats.size) / 10),
          sanity: stats.power,
          maxSanity: 99,
          bonusDamage: getBonusDamage(stats.strength + stats.size, _bonusDamageTable),
          ideaRoll: stats.intelligence,
        };

        set({ derivedStats });
      },

      fetchBonusDamageTable: async () => {
        const { _bonusDamageTable, _bonusDamageTableLoading } = get();
        if (_bonusDamageTable || _bonusDamageTableLoading) return;

        set({ _bonusDamageTableLoading: true });
        try {
          const config = await gameConfigApi.getCombatConfig();
          const table = config.combat_damage_bonus_table || null;
          set({ _bonusDamageTable: table, _bonusDamageTableLoading: false });

          // Re-derive stats now that the table is loaded
          get().recalculateDerivedStats();
        } catch (error) {
          logger.warn('[WizardStore] Failed to fetch bonus damage table, using fallback', { error });
          set({ _bonusDamageTableLoading: false });
        }
      },

      loadCreationConfig: async () => {
        try {
          const config = await characterApi.getCreationConfig();
          set({ creationConfig: config });
        } catch (error) {
          logger.error('[WizardStore] Failed to load creation config:', { error });
          // Fallback to default values if API fails
          set({
            creationConfig: {
              stats: { totalPoints: 450, minValue: 20, maxStatsAbove80: 2, creationCap: 85, gameplayCap: 99 },
              skills: { totalPoints: 250, creationCap: 75, creationCapWithOccupation: 80 },
              occupation: {},
              limits: {
                referenceYear: 1895,
                age: { min: 16, max: 80 },
                weight: { min: 30, max: 200, unit: 'kg' },
                height: { min: 100, max: 250, unit: 'cm' },
                backgroundFields: {
                  briefHistory:           { minChar: 50,  maxChar: 4000 },
                  significantEvents:      { minChar: 0,   maxChar: 2500 },
                  importantRelationships: { minChar: 0,   maxChar: 2500 },
                  personality:            { minChar: 50,  maxChar: 2500 },
                  ideology:               { minChar: 0,   maxChar: 2500 },
                },
              },
              socialClasses: [],
              formulas: {},
            }
          });
        }
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
        const { skills, occupation, dynamicSkills, stats, creationConfig, baseClaimedByOcc, baseClaimedByHobby } = get();
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

        // Base pool first when adding, base pool LAST when removing: claim/
        // release it here, in real time, as this specific edit happens. See
        // WizardData doc - this is the single point where manualPoints/
        // requiredBonus actually change, so it's the only place that needs to
        // know the spend order.
        const oldSpent = currentSkill.manualPoints + currentSkill.requiredBonus;
        const newSpent = updatedSkill.manualPoints + updatedSkill.requiredBonus;
        const delta = newSpent - oldSpent;

        let newBaseClaimedByOcc = baseClaimedByOcc;
        let newBaseClaimedByHobby = baseClaimedByHobby;

        if (delta !== 0) {
          const isOccupation = isOccupationSkill(skillName, dynamicSkills, occupation);

          if (delta > 0) {
            // Aumento: prova a reclamare altro base, solo se ce n'è ancora -
            // altrimenti il di più va sul paniere specifico (EDUx4/INTx2).
            const { basePool } = computeSkillPools(stats, creationConfig);
            const available = Math.max(0, basePool - baseClaimedByOcc - baseClaimedByHobby);
            const claim = Math.min(delta, available);
            if (isOccupation) newBaseClaimedByOcc += claim;
            else newBaseClaimedByHobby += claim;
          } else {
            // Diminuzione: libera prima l'eccedenza sul paniere specifico
            // (EDUx4/INTx2) - il base si libera solo quando quella arriva a
            // zero. Il claim non può mai superare la spesa attuale del tipo:
            // bloccarlo a quel tetto realizza esattamente questa priorità.
            const skillsAfterChange = { ...skills, [skillName]: updatedSkill };
            const { spentOccRaw, spentHobbyRaw } = sumSkillSpend(skillsAfterChange, dynamicSkills, occupation);
            if (isOccupation) {
              newBaseClaimedByOcc = Math.min(baseClaimedByOcc, spentOccRaw);
            } else {
              newBaseClaimedByHobby = Math.min(baseClaimedByHobby, spentHobbyRaw);
            }
          }
        }

        set({
          skills: {
            ...skills,
            [skillName]: updatedSkill,
          },
          baseClaimedByOcc: newBaseClaimedByOcc,
          baseClaimedByHobby: newBaseClaimedByHobby,
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
       * Applies occupation bonuses to required skills (boost to requiredSkillMinimum) and bonus skill.
       *
       * **Logic**:
       * - Required skills: If current total < requiredSkillMinimum, apply requiredBonus = (requiredSkillMinimum - base)
       * - Bonus skill: Apply occupationBonus (configurable, default 30 - can exceed 75, up to 80)
       *
       * @param requiredSkillIds - Array of required skill IDs
       * @param bonusSkillId - Single bonus skill ID
       */
      applyOccupationBonuses: (requiredSkills, bonusSkill) => {
        const { skills, creationConfig } = get();
        const updatedSkills = { ...skills };
        const requiredSkillMinimum = creationConfig?.occupation?.requiredSkillMinimum ?? 30;
        const bonusSkillPoints = creationConfig?.occupation?.bonusSkillPoints ?? 30;

        // Required skills: boost to requiredSkillMinimum if below
        for (const skillName of requiredSkills) {
          if (updatedSkills[skillName]) {
            const current = updatedSkills[skillName].total;
            if (current < requiredSkillMinimum) {
              updatedSkills[skillName].requiredBonus = requiredSkillMinimum - updatedSkills[skillName].base;
              updatedSkills[skillName].total =
                updatedSkills[skillName].base +
                updatedSkills[skillName].requiredBonus +
                updatedSkills[skillName].manualPoints +
                updatedSkills[skillName].occupationBonus;
            }
          }
        }

        // Bonus skill: configurable points (default 30)
        if (updatedSkills[bonusSkill]) {
          updatedSkills[bonusSkill].occupationBonus = bonusSkillPoints;
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
       * This ensures skills reach the required minimum (default 30) without consuming user budget.
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
        if (!occupationData?.requiredSkillSlots || !skillDefinitions?.length) {
          logger.warn('[wizardStore] Cannot auto-assign: missing occupation or skill data');
          return;
        }

        const { skills, stats, creationConfig } = get();
        const updatedSkills = { ...skills };
        const defaultBonusSkillPoints = creationConfig?.occupation?.bonusSkillPoints ?? 30;
        const requiredMinimum = creationConfig?.occupation?.requiredSkillMinimum ?? 30;
        let changesMade = false;

        const requiredPlaceholderSkills: string[] = [];
        // Every catalog skill ID appearing in ANY slot option (all options, not just the
        // one auto-assigned/chosen) plus every bonus skill - the whole list is "professional"
        // for the EDUx4 skill-point-pool purposes, see WizardOccupation.occupationSkillIds.
        const occupationSkillIds: string[] = [];

        // Collect dynamic skill IDs to preserve their requiredBonus (set by user via PlaceholderSkillManager)
        const { dynamicSkills: currentDynamicSkills } = get();
        const dynamicSkillIds = new Set(currentDynamicSkills.map((ds) => ds.skillId));

        // FIRST: Clear old requiredBonus when occupation changes (skip dynamic/placeholder skills)
        Object.keys(updatedSkills).forEach((skillId) => {
          const skill = updatedSkills[skillId];
          if (skill && skill.requiredBonus > 0 && !dynamicSkillIds.has(skillId)) {
            skill.requiredBonus = 0;
            skill.total = skill.base + skill.manualPoints + skill.occupationBonus;
            changesMade = true;
          }
        });

        // SECOND: Process each required skill slot
        occupationData.requiredSkillSlots.forEach((slot: any) => {
          const options = slot.options || [];
          if (options.length === 0) return;

          // Every option on the slot's list is "professional" for pool purposes,
          // regardless of how many options there are or which one gets auto-assigned.
          options.forEach((opt: any) => {
            if (opt.isPlaceholder) {
              requiredPlaceholderSkills.push(opt.name);
              return;
            }
            const optDef = skillDefinitions.find(
              (s: any) => s.id === opt.skillId || s.id === opt.id || s.name === opt.name
            );
            if (optDef) {
              occupationSkillIds.push(optDef.id);
            }
          });

          // Multi-option slot: player must choose, skip auto-assign
          if (options.length > 1) {
            return;
          }

          // Single option: auto-assign
          const skillOption = options[0];

          // Find skill definition by ID
          const skillDef = skillDefinitions.find(
            (s: any) => s.id === skillOption.skillId || s.name === skillOption.name
          );

          if (!skillDef) {
            logger.warn(`[wizardStore] Skill not found: ${skillOption.name}`);
            return;
          }

          if (skillDef.isPlaceholder) {
            return;
          }

          const resolvedBase = resolveSkillBaseValue(skillDef.baseFormula, skillDef.baseValue, stats);
          const currentSkill = updatedSkills[skillDef.id] || {
            base: resolvedBase,
            requiredBonus: 0,
            manualPoints: 0,
            occupationBonus: 0,
            total: resolvedBase,
            category: skillDef.category,
          };

          if (currentSkill.base !== resolvedBase) {
            currentSkill.base = resolvedBase;
            currentSkill.total = resolvedBase + currentSkill.requiredBonus + currentSkill.manualPoints + currentSkill.occupationBonus;
          }

          const newRequiredBonus = Math.max(0, requiredMinimum - currentSkill.base);

          if (currentSkill.requiredBonus !== newRequiredBonus) {
            currentSkill.requiredBonus = newRequiredBonus;
            currentSkill.total =
              currentSkill.base +
              currentSkill.requiredBonus +
              currentSkill.manualPoints +
              currentSkill.occupationBonus;

            const cap = currentSkill.occupationBonus > 0 ? 80 : 75;
            if (currentSkill.total > cap) {
              const excess = currentSkill.total - cap;
              currentSkill.manualPoints = Math.max(0, currentSkill.manualPoints - excess);
              currentSkill.total = cap;
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
              logger.warn(`[wizardStore] Bonus skill not found: ${bonusSkill.name}`);
              return;
            }

            if (skillDef.isPlaceholder) {
              requiredPlaceholderSkills.push(skillDef.name);
            } else {
              occupationSkillIds.push(skillDef.id);
            }

            const resolvedBonusBase = resolveSkillBaseValue(skillDef.baseFormula, skillDef.baseValue, stats);
            const currentSkill = updatedSkills[skillDef.id] || {
              base: resolvedBonusBase,
              requiredBonus: 0,
              manualPoints: 0,
              occupationBonus: 0,
              total: resolvedBonusBase,
              category: skillDef.category,
            };

            if (currentSkill.base !== resolvedBonusBase) {
              currentSkill.base = resolvedBonusBase;
            }

            const bonusValue = bonusSkill.bonusValue || defaultBonusSkillPoints;
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
        const dedupedOccupation = {
          ...get().occupation,
          requiredPlaceholderSkills: Array.from(new Set(requiredPlaceholderSkills)),
          occupationSkillIds: Array.from(new Set(occupationSkillIds)),
          occupationBonusesApplied: true, // Mark as applied after auto-assignment
        };

        // Occupation just (re)selected: this is a reset point for base-claim
        // tracking, no incremental history to preserve. Recompute both claims
        // from scratch, deterministically (computeInitialBaseClaims doc).
        const { spentOccRaw, spentHobbyRaw } = sumSkillSpend(updatedSkills, get().dynamicSkills, dedupedOccupation);
        const pools = computeSkillPools(stats, creationConfig);
        const { baseClaimedByOcc, baseClaimedByHobby } = computeInitialBaseClaims(spentOccRaw, spentHobbyRaw, pools.basePool);

        const updates: any = {
          occupation: dedupedOccupation,
          baseClaimedByOcc,
          baseClaimedByHobby,
        };

        if (changesMade) {
          updates.skills = updatedSkills;
        }

        set(updates);
        logger.info(`[wizardStore] Auto-assigned required skills. Placeholders tracked: [${requiredPlaceholderSkills.join(', ')}]`);
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
          logger.warn(`[WizardStore] Skill already exists: ${skill.skillId}`);
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
      validateStep: (step) => {
        const state = get();
        const validators: Record<number, () => import('@/types/wizard').ValidationResult> = {
          1: () => require('@/components/character/wizard/validation/wizardValidation').validateStep1(state.basicInfo, state.occupation, state.creationConfig),
          2: () => require('@/components/character/wizard/validation/wizardValidation').validateStep2(state.occupation),
          3: () => require('@/components/character/wizard/validation/wizardValidation').validateStep3(state.stats, state.creationConfig),
          4: () => require('@/components/character/wizard/validation/wizardValidation').validateStep4(state.skills, state.stats, state.occupation, state.dynamicSkills, state.creationConfig, state.baseClaimedByOcc, state.baseClaimedByHobby),
          5: () => require('@/components/character/wizard/validation/wizardValidation').validateStep5(state.background, state.creationConfig),
          6: () => {
            const v = require('@/components/character/wizard/validation/wizardValidation');
            const allValid = [1, 2, 3, 4, 5].every((s) => {
              const r = {
                1: v.validateStep1(state.basicInfo, state.occupation, state.creationConfig),
                2: v.validateStep2(state.occupation),
                3: v.validateStep3(state.stats, state.creationConfig),
                4: v.validateStep4(state.skills, state.stats, state.occupation, state.dynamicSkills, state.creationConfig, state.baseClaimedByOcc, state.baseClaimedByHobby),
                5: v.validateStep5(state.background, state.creationConfig),
              }[s];
              return r?.valid ?? true;
            });
            return { valid: allValid, errors: {} };
          },
        };
        const validator = validators[step];
        return validator ? validator() : { valid: true, errors: {} };
      },

      validateAll: () => {
        const errors: Record<string, string> = {};
        for (let step = 1; step <= 5; step++) {
          const stepResult = get().validateStep(step);
          if (!stepResult.valid) {
            // Riporta i messaggi effettivi calcolati da validateStep, non un
            // placeholder generico: Step6Review li mostra all'utente e deve
            // sapere cosa correggere, non solo "quale step ha problemi".
            Object.entries(stepResult.errors).forEach(([field, message]) => {
              errors[`step${step}_${field}`] = message;
            });
          }
        }
        const { occupation } = get();
        if (occupation.occupationBonusesApplied === false) {
          errors.step4_occupationBonuses = "Devi applicare i bonus dell'occupazione (Step 4)";
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
       * - firstName → name (direct, no concatenation)
       * - lastName → surname (optional)
       * - birthPlace → birthPlace (same name, no transformation)
       * - appearance → appearance (same name, no transformation)
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

        // Transform dynamicSkills for backend (Character.dynamicSkills schema)
        const { dynamicSkills } = get();
        const transformedDynamicSkills = dynamicSkills.map((ds) => {
          const breakdown = skills[ds.skillId];
          return {
            skillName: `${ds.name} (${ds.specialization || ''})`,
            basedOnTemplate: ds.name,
            customValue: ds.specialization || '',
            value: breakdown?.total || 0,
            base: breakdown?.base || 0,
            requiredBonus: breakdown?.requiredBonus || 0,
            manualPoints: breakdown?.manualPoints || 0,
            occupationBonus: breakdown?.occupationBonus || 0,
            category: breakdown?.category || 'general',
          };
        });

        const payload: CharacterCreatePayload = {
          // Basic info (field name reconciliation as per CharacterCreatePayload type)
          firstName: basicInfo.firstName,
          surname: basicInfo.lastName || undefined,
          birthDate: basicInfo.birthDate || undefined,
          birthPlace: basicInfo.birthPlace,
          age: basicInfo.age,
          apparentAge: basicInfo.apparentAge,
          gender: basicInfo.gender as 'male' | 'female',
          height: basicInfo.height,
          weight: basicInfo.weight,
          eyeColor: basicInfo.eyeColor,
          hairColor: basicInfo.hairColor,
          visibleMarks: basicInfo.visibleMarks,
          hiddenMarks: basicInfo.hiddenMarks,
          prestavolto: basicInfo.prestavolto,
          maritalStatus: basicInfo.maritalStatus,
          illnesses: basicInfo.illnesses,
          educationTitle: basicInfo.educationTitle,
          criminalRecord: basicInfo.criminalRecord,
          pathologies: basicInfo.pathologies,
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
            bonusDamage: derivedStats.bonusDamage,
            ideaRoll: derivedStats.ideaRoll,
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

          // Dynamic skills (placeholder specializations)
          dynamicSkills: transformedDynamicSkills,

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
        logger.info('[WizardStore] loadFromDraft called', { value: {
          id: character._id,
          name: character.name,
          surname: character.surname,
          hasStats: !!character.stats,
          hasDerived: !!character.derived,
          hasSkills: !!character.skills,
          hasBackground: !!character.background,
          updatedAt: character.updatedAt,
        } });

        // firstName → firstName (no reconciliation), surname → lastName
        const firstName = character.firstName || '';
        const surname = character.surname || '';

        // Process skills (handle both Map and plain object)
        const skillsObj: Record<string, any> = {};
        if (character.skills) {
          const rawEntries: Array<[string, any]> = character.skills instanceof Map
            ? Array.from(character.skills.entries() as IterableIterator<[string, any]>)
            : Object.entries(character.skills);

          rawEntries.forEach(([key, value]) => {
            if (!key.match(/^[0-9a-f]{24}$/i)) return;
            if (typeof value === 'number') {
              skillsObj[key] = {
                total: value, base: 0, requiredBonus: 0,
                manualPoints: value, occupationBonus: 0, category: 'general',
              };
            } else if (value && typeof value === 'object') {
              skillsObj[key] = value;
            }
          });
        }

        // Derived stats from character.derived (calculated by backend pre-save hook)
        const derived = character.derived || {};
        const charStats = character.stats || {};

        // SINGLE ATOMIC set() — avoids intermediate renders and persist middleware race conditions
        set({
          _draftCharacterId: character._id,
          _serverUpdatedAt: character.updatedAt || null,
          basicInfo: {
            firstName,
            lastName: surname,
            birthDate: character.birthDate || '',
            birthPlace: character.birthPlace || '',
            age: character.age || 25,
            apparentAge: character.apparentAge || 25,
            gender: (character.gender as 'male' | 'female' | '') || '',
            height: character.height || '',
            weight: character.weight || '',
            eyeColor: character.eyeColor || '',
            hairColor: character.hairColor || '',
            visibleMarks: character.visibleMarks || '',
            hiddenMarks: character.hiddenMarks || '',
            prestavolto: character.prestavolto || '',
            maritalStatus: character.maritalStatus || '',
            illnesses: character.illnesses || '',
            educationTitle: character.educationTitle || '',
            criminalRecord: character.criminalRecord || '',
            pathologies: character.pathologies || '',
            publicDescription: character.publicDescription || '',
            privateDescription: character.privateDescription || '',
            physicalDescription: character.physicalDescription || '',
          },
          occupation: {
            occupationId: character.occupation || '',
            currentOccupation: character.currentOccupation || '',
            selectedAlternativeSkills: {},
            occupationBonusesApplied: true,
            requiredPlaceholderSkills: [],
            occupationSkillIds: [], // Recomputed by the Step 4 effect on mount (autoAssignRequiredSkills)
          },
          stats: {
            strength: charStats.strength || 20,
            dexterity: charStats.dexterity || 20,
            intelligence: charStats.intelligence || 20,
            constitution: charStats.constitution || 20,
            appearance: charStats.appearance || charStats.charm || 20,
            power: charStats.power || 20,
            size: charStats.size || 20,
            education: charStats.education || 20,
          },
          derivedStats: {
            hitPoints: derived.hitPoints || charStats.hitPoints || 4,
          sanity: derived.sanity ?? derived.sanityPoints ?? charStats.sanity ?? 20,
          maxSanity: derived.maxSanity ?? charStats.maxSanity ?? 99,
          bonusDamage: derived.bonusDamage ?? derived.damageBonus ?? charStats.bonusDamage ?? '-2',
            ideaRoll: derived.ideaRoll ?? charStats.ideaRoll ?? 20,
          },
          skills: skillsObj,
          // Placeholder until autoAssignRequiredSkills runs (Step4Skills mount) and
          // establishes the real baseline from occupation.occupationSkillIds, not
          // yet known at draft-load time.
          baseClaimedByOcc: 0,
          baseClaimedByHobby: 0,
          background: character.background ? {
            briefHistory: character.background.briefHistory || '',
            significantEvents: character.background.significantEvents || '',
            importantRelationships: character.background.importantRelationships || '',
            personality: character.background.personality || '',
            ideology: character.background.ideology || '',
            significantPlaces: character.background.significantPlaces || '',
            fearsAndPhobias: character.background.fearsAndPhobias || '',
            secrets: character.background.secrets || '',
            goalsAndMotivations: character.background.goalsAndMotivations || '',
          } : get().background,
        });

        logger.info('[WizardStore] loadFromDraft completed', { value: {
          firstName: get().basicInfo.firstName,
          occupationId: get().occupation.occupationId,
          skillCount: Object.keys(get().skills).length,
          stats: get().stats,
          derivedStats: get().derivedStats,
        } });
      },
    }),
      {
        name: 'wizard-draft',
        partialize: (state) => ({
          _draftCharacterId: state._draftCharacterId,
          _serverUpdatedAt: state._serverUpdatedAt,
          currentStep: state.currentStep,
          basicInfo: state.basicInfo,
          occupation: state.occupation,
          stats: state.stats,
          derivedStats: state.derivedStats,
          skills: state.skills,
          dynamicSkills: state.dynamicSkills,
          background: state.background,
        }),
        onRehydrateStorage: () => {
          return (_state, error) => {
            if (!error) {
              useWizardStore.setState({ _hasHydrated: true });
            }
          };
        },
      }
    ),
    { name: 'WizardStore' }
  )
);
