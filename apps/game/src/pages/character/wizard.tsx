import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useGame } from '@/contexts/GameContext';
import { GameLayout } from '@/components/GameLayout';
import { WizardStep1_BasicInfo } from '@/components/character/wizard/WizardStep1_BasicInfo';
import { WizardStep2_Stats } from '@/components/character/wizard/WizardStep2_Stats';
import { WizardStep3_Skills } from '@/components/character/wizard/WizardStep3_Skills';
import { WizardStep4_Occupation } from '@/components/character/wizard/WizardStep4_Occupation';
import { WizardStep5_Background } from '@/components/character/wizard/WizardStep5_Background';
import { WizardStep6_Review } from '@/components/character/wizard/WizardStep6_Review';
import styles from '@/styles/components/CharacterWizard.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

// Occupation interface for wizard (aligned with database model)
interface OccupationData {
  id: string;
  name: string;
  description: string;
  allowedGenders: string[];
  socialClass: string[];
  dailySalary: number;
  socialRespectability: number;
  category: string;
  contacts?: string;
  earnings?: string;
  // Skills system (optional)
  requiredSkills?: Array<{
    skillId?: string;
    skillName: string;
    baseValue: number;      // Minimum value required (from DB, default 40)
    isFixed?: boolean;
    alternatives?: Array<{
      skillId?: string;
      skillName: string;
    }>;
  }>;
  bonusSkills?: Array<{
    skillId?: string;
    skillName: string;
    bonusValue: number;
  }>;
  // Victorian context (optional)
  typicalEmployers?: string[];
  careerProgression?: string[];
  workingConditions?: string;
  rarity?: string;
  // API may include these legacy fields
  prerequisites?: any;
  benefits?: any;
}

// Granular skill tracking interface
export interface SkillBreakdown {
  total: number;              // Computed: base + requiredBonus + manualPoints + occupationBonus
  base: number;               // From skill definition (formula or fixed)
  requiredBonus: number;      // Auto-applied: (40 - base) for required skills, 0 otherwise
  manualPoints: number;       // Player-allocated points (ONLY these count toward budget)
  occupationBonus: number;    // From occupation.bonusSkills (+30 for selected bonus skill)
}

// Helper to check if skill uses granular format
export function isGranularSkill(value: number | SkillBreakdown | undefined): value is SkillBreakdown {
  return typeof value === 'object' && value !== null && 'base' in value;
}

// Helper to get total value regardless of format
export function getSkillTotal(value: number | SkillBreakdown | undefined): number {
  if (value === undefined) return 0;
  return isGranularSkill(value) ? value.total : value;
}

// Helper to get manual points only (for budget calculation)
export function getManualPoints(value: number | SkillBreakdown | undefined): number {
  if (value === undefined) return 0;
  return isGranularSkill(value) ? value.manualPoints : value;
}

// Convert old format to granular
export function migrateSkillToGranular(
  skillName: string,
  currentValue: number,
  baseValue: number,
  occupation: OccupationData | null | undefined
): SkillBreakdown {
  // Only apply requiredBonus if isFixed === true
  // If isFixed === false, the user must manually choose which alternative to develop
  const isFixedRequired = occupation?.requiredSkills?.some(
    req => req.skillName === skillName && req.isFixed === true
  );

  const isBonusSelected = occupation?.bonusSkills?.some(
    bonus => bonus.skillName === skillName
  );

  const REQUIRED_SKILL_MINIMUM = parseInt(
    process.env.NEXT_PUBLIC_OCCUPATION_REQUIRED_SKILL_MINIMUM || '40'
  );
  const BONUS_SKILL_POINTS = parseInt(
    process.env.NEXT_PUBLIC_OCCUPATION_BONUS_SKILL_POINTS || '30'
  );

  // Only apply requiredBonus if it's a FIXED required skill (no alternatives)
  const requiredBonus = isFixedRequired ? Math.max(0, REQUIRED_SKILL_MINIMUM - baseValue) : 0;
  const occupationBonus = isBonusSelected ? BONUS_SKILL_POINTS : 0;
  const manualPoints = Math.max(0, currentValue - baseValue - requiredBonus - occupationBonus);

  return {
    total: currentValue,
    base: baseValue,
    requiredBonus,
    manualPoints,
    occupationBonus
  };
}

// Centralized validation result interface
interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  pointsUsed?: number;
  pointsTotal?: number;
  pointsRemaining?: number;
  // Step 4 (Skills) specific - separated points tracking
  basePointsUsed?: number;
  basePointsTotal?: number;
  intPointsUsed?: number;
  intPointsTotal?: number;
  requiredPoints?: number; // Required skills (obbligatori, scalano dal budget)
  bonusPoints?: number;    // Bonus skills (GRATIS, non scalano dal budget)
}

interface ValidationResults {
  [stepId: number]: StepValidationResult;
}

// Character data interface for wizard (NEW SYSTEM)
export interface CharacterWizardData {
  // Step 1: Basic Info + Anagrafica Completa (ALL REQUIRED)
  firstName: string;
  lastName: string;
  birthDate: string;  // Format: gg/mm/yyyy
  age: number | null;  // Calculated from birthDate
  apparentAge: number | null;  // User-editable apparent age
  gender: 'male' | 'female' | null;
  birthPlace?: string;  // Optional: birthplace
  // Anagrafica completa (ALL REQUIRED)
  height: string;
  weight: string;  // Weight in kg or other unit
  eyeColor: string;  // Eye color (separated from combined field)
  hairColor: string;  // Hair color (separated from combined field)
  visibleMarks: string;
  hiddenMarks: string;
  maritalStatus: string;
  illnesses: string;
  educationTitle: string;
  criminalRecord: string;
  currentOccupation: string;  // Free text field for current occupation (REQUIRED)

  // Step 2: Stats (Character Stats & Derived Stats)
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    constitution: number;
    size: number;
    charm: number;
    power: number;
    education: number;
  };
  derived: {
    ideaRoll: number;       // Tiro Idea = INT
    luckRoll: number;       // Tiro Fortuna = POT
    knowledge: number;      // Conoscenze = EDU
    hitPoints: number;      // Punti Ferita = (TAG + COS) / 10
    sanityPoints: number;   // Punti Sanità = POT iniziali
    magicPoints: number;    // Punti Magia = POT / 5
    damageBonus: string;    // Bonus al Danno da tabella FOR + TAG
    build: number;          // Corporatura da tabella FOR + TAG
  };

  // Step 3: Skills (with alternative skill selection - now supports granular tracking)
  skills: Record<string, number | SkillBreakdown>;
  dynamicSkills: {
    skillName: string;        // e.g., "Lingua (Francese)"
    basedOnTemplate: string;  // e.g., "Lingua"
    customValue: string;      // e.g., "Francese"
    value: number;            // skill points
    category: string;         // inherited from template
  }[];
  // NEW: Track which alternative skill was chosen for "choice" requirements
  selectedAlternativeSkills?: { [requirementId: string]: string };

  // Step 4: Occupation (with bonus application)
  occupation: OccupationData | null; // Full occupation object for UI
  occupationBonusesApplied?: boolean; // Track if bonuses were applied

  // Step 5: Background Guidato Strutturato (NEW SYSTEM)
  background?: {
    briefHistory?: string;           // Breve storia (max 4000 chars)
    significantEvents?: string;      // Eventi significativi
    importantRelationships?: string; // Relazioni importanti
    personality?: string;            // Personalità
    ideology?: string;               // Ideologia e credenze
    significantPlaces?: string;      // Luoghi significativi
    fearsAndPhobias?: string;        // Paure e fobie
    secrets?: string;                // Segreti
    goalsAndMotivations?: string;    // Obiettivi e motivazioni
  };
  // Legacy fields (keep for compatibility during migration)
  publicDescription: string;
  privateDescription: string;
  physicalDescription: string;
  motivations: string;
  fears: string;

  // Validation
  completedSteps: Set<number>;
  invalidSteps: Set<number>; // Track steps that have validation errors
}

// Wizard step configuration (NEW ORDER: Esperienze Pregresse at position 2)
const WIZARD_STEPS = [
  { id: 1, title: 'Informazioni Base', component: WizardStep1_BasicInfo },
  { id: 2, title: 'Esperienze Pregresse', component: WizardStep4_Occupation },  // Occupation now Step 2 (no prerequisites)
  { id: 3, title: 'Caratteristiche', component: WizardStep2_Stats },            // Stats now Step 3
  { id: 4, title: 'Abilità', component: WizardStep3_Skills },                   // Skills now Step 4
  { id: 5, title: 'Background', component: WizardStep5_Background },
  { id: 6, title: 'Revisione', component: WizardStep6_Review }
];

export default function CharacterWizard() {
  const router = useRouter();
  const { gameData, character, updateCharacter } = useGame();
  const [currentStep, setCurrentStep] = useState(1);
  const [dataLoaded, setDataLoaded] = useState(false); // Flag per evitare caricamenti multipli
  const [validationResults, setValidationResults] = useState<ValidationResults>({});
  const [characterData, setCharacterData] = useState<CharacterWizardData>({
    // Initialize with empty values
    firstName: '',
    lastName: '',
    birthDate: '',
    age: null,
    apparentAge: null,
    gender: null,
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
    currentOccupation: '',
    stats: {
      strength: 20,     // New system: all stats start at 20
      dexterity: 20,    // New system: all stats start at 20
      intelligence: 20, // New system: all stats start at 20
      constitution: 20, // New system: all stats start at 20
      size: 20,         // New system: all stats start at 20
      charm: 20,        // New system: all stats start at 20
      power: 20,        // New system: all stats start at 20
      education: 20     // New system: all stats start at 20
    },
    derived: {
      ideaRoll: 20,       // = INT
      luckRoll: 20,       // = POT
      knowledge: 20,      // = EDU
      hitPoints: 4,       // = (TAG + COS) / 10 → (20 + 20) / 10 = 4
      sanityPoints: 20,   // = POT
      magicPoints: 4,     // = POT / 5 → 20 / 5 = 4
      damageBonus: "-2",  // calcolato (20+20=40 ≤ 64)
      build: -2           // calcolato
    },
    occupation: null,
    skills: {},
    dynamicSkills: [], // Initialize empty dynamic skills array
    publicDescription: '',
    privateDescription: '',
    physicalDescription: '',
    motivations: '',
    fears: '',
    background: {}, // Initialize empty background object
    completedSteps: new Set(),
    invalidSteps: new Set([2, 3, 4, 5]) // Initially mark occupation, stats, skills and background steps as invalid
  });

  // Helper function to calculate damage bonus and build
  const calculateDamageBonus = (strength: number, size: number): { damageBonus: string, build: number } => {
    const total = strength + size;
    
    if (total <= 64) return { damageBonus: "-2", build: -2 };
    if (total <= 84) return { damageBonus: "-1", build: -1 };
    if (total <= 124) return { damageBonus: "0", build: 0 };
    if (total <= 164) return { damageBonus: "+1d4", build: 1 };
    if (total <= 204) return { damageBonus: "+1d6", build: 2 };
    if (total <= 284) return { damageBonus: "+2d6", build: 3 };
    if (total <= 364) return { damageBonus: "+3d6", build: 4 };
    if (total <= 444) return { damageBonus: "+4d6", build: 5 };
    
    return { damageBonus: "+5d6", build: 6 };
  };

  // Helper function to calculate derived stats
  const calculateDerivedStats = (stats: typeof characterData.stats) => {
    const damageData = calculateDamageBonus(stats.strength, stats.size);

    return {
      ideaRoll: stats.intelligence,                               // Tiro Idea = INT
      luckRoll: stats.power,                                     // Tiro Fortuna = POT
      knowledge: stats.education,                                // Conoscenze = EDU
      hitPoints: Math.floor((stats.size + stats.constitution) / 10), // PF = (TAG + COS) / 10
      sanityPoints: stats.power,                                 // SAN = POT iniziali
      magicPoints: Math.floor(stats.power / 5),                 // PM = POT / 5
      damageBonus: damageData.damageBonus,                      // Bonus Danno
      build: damageData.build                                   // Corporatura
    };
  };

  // Check if character is DRAFT on component mount
  useEffect(() => {
    if (!character) {
      router.push('/');
      return;
    }

    if (character.status !== 'DRAFT') {
      // Character is not in draft, redirect to location or show appropriate message
      if (character.status === 'PENDING_APPROVAL') {
        router.push('/?pending=true');
      } else if (character.status === 'APPROVED') {
        router.push('/location');
      } else {
        router.push('/');
      }
      return;
    }

    // Load existing draft data if available - now loads from DB instead of empty init
    if (!dataLoaded) {
      loadExistingDraftFromDB();
    }
  }, [character, router, dataLoaded]);

  // Handle URL step parameter
  useEffect(() => {
    const stepParam = router.query.step;
    if (stepParam && typeof stepParam === 'string') {
      const step = parseInt(stepParam);
      if (step >= 1 && step <= WIZARD_STEPS.length) {
        setCurrentStep(step);
      }
    }
  }, [router.query.step]);

  // Update URL when step changes
  useEffect(() => {
    if (router.isReady && router.query.step !== currentStep.toString()) {
      router.replace(`/character/wizard?step=${currentStep}`, undefined, { shallow: true });
    }
  }, [currentStep, router.isReady]);

  // Load existing draft data from DB, with localStorage fallback
  const loadExistingDraftFromDB = async () => {
    if (dataLoaded) {
      // console.log('🧙 Wizard: Data already loaded, skipping...');
      return;
    }

    try {
      // console.log('🧙 Wizard: Loading existing character data from DB...');
      
      // Load character data from backend API
      const response = await fetch(`${API_BASE_URL}/game/characters/${character?.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (response.ok) {
        const characterDBData = await response.json();
        // console.log('🧙 Wizard: Loaded character data from DB:', characterDBData);
        
        // Transform DB data to wizard format
        const dbChar = characterDBData.data?.character || characterDBData;
        // console.log('🧙 Wizard: Transforming DB character data:', dbChar);
        
        // Map firstName/lastName correctly from DB fields
        const firstName = dbChar.name || '';
        const lastName = dbChar.surname || '';
        
        const wizardData: CharacterWizardData = {
          firstName: firstName,
          lastName: lastName,
          birthDate: dbChar.birthDate || '', // NEW: Data di nascita
          age: dbChar.age || null,
          apparentAge: dbChar.apparentAge || null,
          gender: dbChar.gender || null,
          // NEW: Anagrafica completa
          height: dbChar.height || '',
          weight: dbChar.weight || '',
          eyeColor: dbChar.eyeColor || '',
          hairColor: dbChar.hairColor || '',
          visibleMarks: dbChar.visibleMarks || '',
          hiddenMarks: dbChar.hiddenMarks || '',
          maritalStatus: dbChar.maritalStatus || '',
          illnesses: dbChar.illnesses || '',
          educationTitle: dbChar.educationTitle || '',
          criminalRecord: dbChar.criminalRecord || '',
          currentOccupation: dbChar.currentOccupation || '',
          // Stats
          stats: dbChar.stats || {
            strength: 20, dexterity: 20, intelligence: 20, constitution: 20,
            size: 20, charm: 20, power: 20, education: 20
          },
          derived: dbChar.derived || calculateDerivedStats(dbChar.stats || {
            strength: 20, dexterity: 20, intelligence: 20, constitution: 20,
            size: 20, charm: 20, power: 20, education: 20
          }),
          // Skills
          skills: dbChar.skills || {},
          dynamicSkills: dbChar.dynamicSkills || [],
          selectedAlternativeSkills: dbChar.selectedAlternativeSkills,
          // Occupation
          occupation: transformOccupationForWizard(dbChar.occupationData),
          occupationBonusesApplied: dbChar.occupationBonusesApplied,
          // NEW: Background strutturato
          background: dbChar.background || {},
          // Legacy fields (keep for compatibility)
          publicDescription: dbChar.publicDescription || dbChar.description || '',
          privateDescription: dbChar.privateDescription || '',
          physicalDescription: dbChar.physicalDescription || '',
          motivations: dbChar.motivations || '',
          fears: dbChar.fears || '',
          completedSteps: new Set(),
          invalidSteps: new Set()
        };
        
        // console.log('🧙 Wizard: Transformed wizard data:', wizardData);
        
        // Re-validate all steps after loading (without saving to server)
        const processedData = updateCharacterData(wizardData, false);
        
        // Save to localStorage only (not server) to cache the DB data with validation
        const draftToSave = {
          ...processedData,
          completedSteps: Array.from(processedData.completedSteps),
          invalidSteps: Array.from(processedData.invalidSteps)
        };
        localStorage.setItem(`character-draft-${character?.id}`, JSON.stringify(draftToSave));
        // console.log('🧙 Wizard: Character data saved to localStorage');
        
        setDataLoaded(true);
        // console.log('🧙 Wizard: Character data loaded and validated from DB');
        return;
      }
      
      // Fallback to localStorage if DB fails
      // console.log('🧙 Wizard: DB load failed, trying localStorage...');
      const localDraft = localStorage.getItem(`character-draft-${character?.id}`);
      if (localDraft) {
        const parsedDraft = JSON.parse(localDraft);
        const loadedData = {
          ...parsedDraft,
          completedSteps: new Set(parsedDraft.completedSteps || []),
          invalidSteps: new Set(parsedDraft.invalidSteps || [])
        };
        
        updateCharacterData(loadedData, false);
        setDataLoaded(true);
        // console.log('🧙 Wizard: Character data loaded from localStorage');
      } else {
        // console.log('🧙 Wizard: No existing data found, using defaults');
        setDataLoaded(true);
      }
      
    } catch (error) {
      console.error('🧙 Wizard: Failed to load existing draft:', error);
      
      // Try localStorage as final fallback
      try {
        const localDraft = localStorage.getItem(`character-draft-${character?.id}`);
        if (localDraft) {
          const parsedDraft = JSON.parse(localDraft);
          const loadedData = {
            ...parsedDraft,
            completedSteps: new Set(parsedDraft.completedSteps || []),
            invalidSteps: new Set(parsedDraft.invalidSteps || [])
          };
          updateCharacterData(loadedData, false);
          setDataLoaded(true);
          // console.log('🧙 Wizard: Character data loaded from localStorage fallback');
        } else {
          setDataLoaded(true);
        }
      } catch (fallbackError) {
        console.error('🧙 Wizard: Even localStorage fallback failed:', fallbackError);
        setDataLoaded(true);
      }
    }
  };

  // Helper function to filter out empty/null values
  const filterEmptyFields = (obj: any): any => {
    const filtered: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined && value !== '') {
        filtered[key] = value;
      }
    }
    return filtered;
  };

  // Helper function to transform DB occupation to wizard format (NEW SYSTEM)
  const transformOccupationForWizard = (dbOccupation: any): OccupationData | null => {
    if (!dbOccupation) return null;

    // Transform requiredSkills with populated skill data
    const requiredSkills = (dbOccupation.requiredSkills || []).map((req: any) => ({
      skillId: req.skillId?._id || req.skillId,
      skillName: req.skillId?.name || 'Unknown Skill',
      baseValue: req.baseValue || 40,  // Extract baseValue from DB, default to 40
      isFixed: req.isFixed !== undefined ? req.isFixed : true,
      alternatives: (req.alternatives || []).map((alt: any) => ({
        skillId: alt._id || alt,
        skillName: alt.name || 'Unknown Alternative'
      }))
    }));

    // Transform bonusSkills with populated skill data
    const bonusSkills = (dbOccupation.bonusSkills || []).map((bonus: any) => ({
      skillId: bonus.skillId?._id || bonus.skillId,
      skillName: bonus.skillId?.name || 'Unknown Skill',
      bonusValue: bonus.bonusValue || 0
    }));

    return {
      id: dbOccupation._id,
      name: dbOccupation.name,
      description: dbOccupation.description,
      allowedGenders: dbOccupation.allowedGenders || [],
      socialClass: dbOccupation.socialClass || [],
      dailySalary: dbOccupation.dailySalary || 0,
      socialRespectability: dbOccupation.socialRespectability || 0,
      category: dbOccupation.category || '',
      contacts: dbOccupation.contacts || 'Nessuno',
      earnings: dbOccupation.earnings || 'Variabile',
      requiredSkills, // NEW SYSTEM
      bonusSkills    // NEW SYSTEM
    };
  };

  // Save to localStorage only (no server call)
  const saveToLocalStorage = (data: CharacterWizardData) => {
    try {
      const draftToSave = {
        ...data,
        completedSteps: Array.from(data.completedSteps),
        invalidSteps: Array.from(data.invalidSteps)
      };
      localStorage.setItem(`character-draft-${character?.id}`, JSON.stringify(draftToSave));
    } catch (error) {
      console.error('🧙 Wizard: Failed to save to localStorage:', error);
    }
  };

  // Save draft to SERVER only (localStorage is handled separately)
  const saveDraftToServer = async (data: CharacterWizardData) => {
    try {
      // Prepare data for server (only non-empty fields)
      const baseCharacterData = {
        name: data.firstName,
        surname: data.lastName,
        birthDate: data.birthDate, // NEW: Data di nascita (gg/mm/yyyy)
        age: data.age,
        apparentAge: data.apparentAge,
        gender: data.gender,
        // NEW: Anagrafica completa
        height: data.height,
        weight: data.weight,
        eyeColor: data.eyeColor,
        hairColor: data.hairColor,
        visibleMarks: data.visibleMarks,
        hiddenMarks: data.hiddenMarks,
        maritalStatus: data.maritalStatus,
        illnesses: data.illnesses,
        educationTitle: data.educationTitle,
        criminalRecord: data.criminalRecord,
        currentOccupation: data.currentOccupation,
        // Stats
        stats: data.stats,
        derived: data.derived,
        skills: data.skills,
        // Occupation
        occupation: data.occupation?.id,
        occupationBonusesApplied: data.occupationBonusesApplied,
        selectedAlternativeSkills: data.selectedAlternativeSkills,
        // NEW: Background strutturato
        background: data.background,
        // Legacy fields (keep for compatibility)
        physicalDescription: data.physicalDescription,
        publicDescription: data.publicDescription,
        privateDescription: data.privateDescription,
        motivations: data.motivations,
        fears: data.fears
      };

      // Filter out empty fields for server
      const characterUpdateData = filterEmptyFields(baseCharacterData);
      console.log('🧙 Wizard: Saving to server:', characterUpdateData);

      const response = await fetch(`${API_BASE_URL}/game/characters/${character?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(characterUpdateData),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      console.log('🧙 Wizard: Draft saved to server successfully');
      return true;
    } catch (error) {
      console.error('🧙 Wizard: Failed to save draft to server:', error);
      throw error;
    }
  };

  // Manual save function for SALVA button in each step
  const handleManualSave = async () => {
    try {
      console.log('🧙 Wizard: Manual save requested - saving to server');

      // First save to localStorage (instant feedback)
      saveToLocalStorage(characterData);

      // Then save to server
      await saveDraftToServer(characterData);

      // Show success message
      const saveButton = document.querySelector('.manual-save-button');
      if (saveButton) {
        const originalText = saveButton.textContent;
        saveButton.textContent = '✓ SALVATO';
        saveButton.classList.add('saved');
        setTimeout(() => {
          saveButton.textContent = originalText;
          saveButton.classList.remove('saved');
        }, 2000);
      }
    } catch (error) {
      console.error('🧙 Wizard: Manual save failed:', error);
      alert('Errore durante il salvataggio sul server. I dati sono comunque salvati localmente.');
    }
  };

  // Comprehensive centralized validation system (NEW ORDER)
  const validateAllSteps = (data: CharacterWizardData): ValidationResults => {
    const results: ValidationResults = {};

    // Step 1: Basic Info - validation handled by component via onValidationChange callback
    // Preserve existing validation result from component (lifted state)
    results[1] = validationResults[1] || {
      isValid: false,
      errors: ['Compilare tutti i campi obbligatori'],
      warnings: []
    };

    // Step 2: Esperienze Pregresse (Occupation - simplified, no prerequisites)
    const step2Errors: string[] = [];
    if (!data.occupation) step2Errors.push('Esperienze pregresse richieste');

    // No gender restrictions - all occupations available to all genders

    results[2] = {
      isValid: step2Errors.length === 0,
      errors: step2Errors,
      warnings: []
    };

    // Step 3: Caratteristiche (Stats)
    const maxStatPoints = gameData?.draftConfiguration?.characterStatTotalPoints || 400;
    const basePoints = 20;
    const pointsAboveBase = Object.entries(data.stats).reduce((sum, [stat, value]) => {
      const statValue = typeof value === 'number' ? value : basePoints;
      return sum + Math.max(0, statValue - basePoints);
    }, 0);
    const statsAbove85 = Object.values(data.stats).filter(value => value > 85);

    const step3Errors: string[] = [];
    const step3Warnings: string[] = [];

    if (pointsAboveBase !== maxStatPoints) {
      const remaining = maxStatPoints - pointsAboveBase;
      if (remaining > 0) {
        step3Errors.push(`Assegna ancora ${remaining} punti caratteristica`);
      } else {
        const exceeded = pointsAboveBase - maxStatPoints;
        step3Errors.push(`Hai superato il limite di ${exceeded} punti`);
      }
    }

    if (statsAbove85.length > 0) {
      step3Errors.push(`${statsAbove85.length} caratteristiche sopra 85 (limite massimo)`);
    }

    results[3] = {
      isValid: step3Errors.length === 0,
      errors: step3Errors,
      warnings: step3Warnings,
      pointsUsed: pointsAboveBase,
      pointsTotal: maxStatPoints,
      pointsRemaining: maxStatPoints - pointsAboveBase
    };

    // Step 4: Abilità (Skills) - Separated INT and Base Points Logic
    const baseSkillPoints = gameData?.draftConfiguration?.characterSkillTotalPoints || 200;
    const intelligenceBonus = Math.floor((data.stats.intelligence || 50) / 2);
    const maxSkillPoints = baseSkillPoints + intelligenceBonus;
    const baseSkills = gameData?.draftConfiguration?.baseSkills || [];

    // Helper to check if skill is physical (cannot use INT points)
    const isPhysicalSkill = (skillName: string): boolean => {
      const skill = baseSkills.find((s: any) => s.name === skillName);
      if (!skill) return false;
      const category = (skill as any).category;
      return category === 'physical' || category === 'combat';
    };

    // Calculate points spent, separating INT points from base points
    // IMPORTANT: Required skills count toward budget, bonus skills are FREE
    // Budget includes: requiredBonus (obbligatori) + manualPoints (allocati)
    // FREE (not in budget): occupationBonus (gratis)
    let basePointsUsed = 0;
    let intPointsUsed = 0;
    let intPointsAvailable = intelligenceBonus;
    let requiredPoints = 0; // Required skills (obbligatori, scalano dal budget)
    let bonusPoints = 0; // Bonus skills (gratis, NON scalano dal budget)

    Object.entries(data.skills).forEach(([skillName, currentValue]) => {
      // Calculate points that count toward budget
      let pointsToCount = 0;

      if (isGranularSkill(currentValue)) {
        // Required bonus: OBBLIGATORIO, conta nel budget
        requiredPoints += (currentValue.requiredBonus || 0);
        pointsToCount += (currentValue.requiredBonus || 0);

        // Manual points: allocati dal giocatore, contano nel budget
        pointsToCount += (currentValue.manualPoints || 0);

        // Occupation bonus: GRATIS, NON conta nel budget
        bonusPoints += (currentValue.occupationBonus || 0);
      } else {
        // Old format: treat as manual points (count toward budget)
        pointsToCount = typeof currentValue === 'number' ? currentValue : 0;
      }

      if (pointsToCount > 0) {
        if (isPhysicalSkill(skillName)) {
          // Physical skills: ALL points come from base pool
          basePointsUsed += pointsToCount;
        } else {
          // Non-physical skills: use INT points first, then base
          const intPointsForThisSkill = Math.min(pointsToCount, intPointsAvailable);
          const basePointsForThisSkill = pointsToCount - intPointsForThisSkill;

          intPointsUsed += intPointsForThisSkill;
          intPointsAvailable -= intPointsForThisSkill;
          basePointsUsed += basePointsForThisSkill;
        }
      }
    });

    // Dynamic skills are already counted in data.skills loop above
    // Only count dynamic skills that are NOT yet in data.skills (edge case for migration)
    data.dynamicSkills.forEach((dynamicSkill) => {
      // Skip if already counted in data.skills loop
      if (data.skills[dynamicSkill.skillName]) {
        return; // Already counted above, don't double-count
      }

      // Only process if NOT in data.skills (legacy data migration case)
      const templateSkill = baseSkills.find((s: any) => s.name === dynamicSkill.basedOnTemplate);
      let baseValue = 0;
      if (templateSkill?.baseValue) {
        const baseValStr = String(templateSkill.baseValue);
        if (baseValStr.startsWith('FORMULA:')) {
          const formula = baseValStr.replace('FORMULA:', '');
          switch (formula) {
            case 'EDU': baseValue = data.stats.education || 0; break;
            default: baseValue = 1;
          }
        } else {
          baseValue = parseInt(baseValStr) || 0;
        }
      }

      const pointsSpent = Math.max(0, dynamicSkill.value - baseValue);
      if (pointsSpent > 0) {
        // Dynamic skills are typically knowledge skills (not physical)
        const intPointsForThisSkill = Math.min(pointsSpent, intPointsAvailable);
        const basePointsForThisSkill = pointsSpent - intPointsForThisSkill;

        intPointsUsed += intPointsForThisSkill;
        intPointsAvailable -= intPointsForThisSkill;
        basePointsUsed += basePointsForThisSkill;
      }
    });

    const totalSkillPoints = basePointsUsed + intPointsUsed;
    const step4Errors: string[] = [];

    // Check if base points exceeded
    if (basePointsUsed > baseSkillPoints) {
      step4Errors.push(`Hai superato i punti base di ${basePointsUsed - baseSkillPoints} punti`);
    }

    // Check if INT points exceeded
    if (intPointsUsed > intelligenceBonus) {
      step4Errors.push(`Hai superato i punti INT di ${intPointsUsed - intelligenceBonus} punti`);
    }

    // Check if all points are used
    const totalPointsRemaining = (baseSkillPoints - basePointsUsed) + (intelligenceBonus - intPointsUsed);
    if (totalPointsRemaining > 0) {
      step4Errors.push(`Assegna ancora ${totalPointsRemaining} punti abilità (${baseSkillPoints - basePointsUsed} base + ${intelligenceBonus - intPointsUsed} INT)`);
    }

    // Validate individual skill caps (75 general, 80 with occupation bonus)
    Object.entries(data.skills).forEach(([skillName, skillValue]) => {
      const total = getSkillTotal(skillValue);

      // Standard cap during creation
      if (total > 75) {
        // Check if occupation bonus allows up to 80
        if (isGranularSkill(skillValue) && skillValue.occupationBonus > 0) {
          if (total > 80) {
            step4Errors.push(`${skillName}: ${total} punti (massimo 80 con bonus occupazione)`);
          }
        } else {
          step4Errors.push(`${skillName}: ${total} punti (massimo 75 durante creazione)`);
        }
      }
    });

    // Also check dynamic skills
    data.dynamicSkills.forEach((dynamicSkill) => {
      if (dynamicSkill.value > 75) {
        step4Errors.push(`${dynamicSkill.skillName}: ${dynamicSkill.value} punti (massimo 75 durante creazione)`);
      }
    });

    // Validate required skills with alternatives - only ONE alternative needs to meet baseValue
    if (data.occupation?.requiredSkills) {
      data.occupation.requiredSkills.forEach((requirement) => {
        const requiredMinimum = requirement.baseValue || 40;

        if (requirement.isFixed) {
          // Fixed skill (no alternatives) - main skill must meet requirement
          const mainSkillValue = getSkillTotal(data.skills[requirement.skillName]);
          if (mainSkillValue < requiredMinimum) {
            step4Errors.push(`${requirement.skillName}: richiede almeno ${requiredMinimum} punti (hai ${mainSkillValue})`);
          }
        } else {
          // Optional skill (with alternatives) - at least ONE skill must meet requirement
          const skillsToCheck = [requirement.skillName, ...(requirement.alternatives?.map(alt => alt.skillName) || [])];
          const hasValidSkill = skillsToCheck.some(skillName => {
            const skillValue = getSkillTotal(data.skills[skillName]);
            return skillValue >= requiredMinimum;
          });

          if (!hasValidSkill) {
            const skillsList = skillsToCheck.join(' o ');
            step4Errors.push(`Devi avere almeno ${requiredMinimum} punti in una di: ${skillsList}`);
          }
        }
      });
    }

    results[4] = {
      isValid: step4Errors.length === 0,
      errors: step4Errors,
      warnings: [],
      pointsUsed: totalSkillPoints,
      pointsTotal: maxSkillPoints,
      pointsRemaining: totalPointsRemaining,
      // NEW: Add separated points info
      basePointsUsed,
      basePointsTotal: baseSkillPoints,
      intPointsUsed,
      intPointsTotal: intelligenceBonus,
      requiredPoints, // Required skills (contano nel budget, obbligatori)
      bonusPoints     // Bonus skills (GRATIS, non contano nel budget)
    };

    // Step 5: Background
    const step5Errors: string[] = [];
    if (!data.publicDescription.trim()) step5Errors.push('Descrizione pubblica richiesta');
    if (!data.physicalDescription.trim()) step5Errors.push('Descrizione fisica richiesta');

    results[5] = {
      isValid: step5Errors.length === 0,
      errors: step5Errors,
      warnings: []
    };

    // Step 6: Review
    const allPreviousStepsValid = Object.values(results).every(result => result.isValid);
    results[6] = {
      isValid: allPreviousStepsValid,
      errors: allPreviousStepsValid ? [] : ['Completa tutti gli step precedenti'],
      warnings: []
    };

    return results;
  };

  // Simple wrapper for backward compatibility
  const validateStep = (stepId: number, data: CharacterWizardData): boolean => {
    const results = validateAllSteps(data);
    return results[stepId]?.isValid || false;
  };

  /**
   * Auto-apply required skills to minimum value (parametric)
   * Called when occupation is selected or changed
   * NEW: Only processes fixed skills (without alternatives)
   */
  const applyRequiredSkillsAuto = (
    newOccupation: OccupationData,
    currentSkills: Record<string, number | SkillBreakdown>,
    availableSkills: { id: string; name: string; category: string; base?: number; baseValue?: string | number }[]
  ): Record<string, number | SkillBreakdown> => {
    const updatedSkills = { ...currentSkills };

    newOccupation.requiredSkills?.forEach(requirement => {
      // Use baseValue from requirement object (from DB), fallback to 40 if not present
      const requiredMinimum = requirement.baseValue || 40;

      // Only process skills WITHOUT alternatives (fixed skills)
      // For skills with alternatives, let the user choose which one to develop
      if (requirement.isFixed) {
        // Process only the main skill (no alternatives)
        const skillName = requirement.skillName;
        const skillDef = availableSkills.find(s => s.name === skillName);
        if (!skillDef) return;

        // Calculate base value (handle formulas)
        let baseValue = 0;
        if (skillDef.baseValue) {
          const baseValStr = String(skillDef.baseValue);
          if (baseValStr.startsWith('FORMULA:')) {
            const formula = baseValStr.replace('FORMULA:', '');
            switch (formula) {
              case 'EDU': baseValue = characterData.stats.education || 0; break;
              case 'DEX': case 'DES': baseValue = characterData.stats.dexterity || 0; break;
              case 'INT': baseValue = characterData.stats.intelligence || 0; break;
              case 'POT': case 'POW': baseValue = characterData.stats.power || 0; break;
              default: baseValue = 0;
            }
          } else {
            baseValue = parseInt(baseValStr) || 0;
          }
        } else if (skillDef.base !== undefined) {
          baseValue = skillDef.base;
        }

        const currentValue = updatedSkills[skillName];
        const breakdown: SkillBreakdown = isGranularSkill(currentValue)
          ? { ...currentValue }
          : migrateSkillToGranular(skillName, getSkillTotal(currentValue), baseValue, newOccupation);

        // Set required bonus to bring skill to minimum (using DB baseValue)
        breakdown.base = baseValue;
        breakdown.requiredBonus = Math.max(0, requiredMinimum - breakdown.base);
        breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;

        updatedSkills[skillName] = breakdown;
      }
      // If requirement has alternatives, DON'T process them automatically
      // Let the user manually invest in ONE of the alternatives
    });

    return updatedSkills;
  };

  /**
   * Apply occupation bonus skills immediately with granular tracking
   */
  const applyOccupationBonusesGranular = (
    occupation: OccupationData,
    currentSkills: Record<string, number | SkillBreakdown>,
    availableSkills: { id: string; name: string; category: string; base?: number; baseValue?: string | number }[]
  ): Record<string, number | SkillBreakdown> => {
    const updatedSkills = { ...currentSkills };

    occupation.bonusSkills?.forEach(bonusSkill => {
      const skillName = bonusSkill.skillName;
      // Use bonusValue from bonusSkill object (from DB), fallback to 30 if not present
      const bonusPoints = bonusSkill.bonusValue || 30;

      const skillDef = availableSkills.find(s => s.name === skillName);
      if (!skillDef) return;

      // Calculate base value
      let baseValue = 0;
      if (skillDef.baseValue) {
        const baseValStr = String(skillDef.baseValue);
        if (baseValStr.startsWith('FORMULA:')) {
          const formula = baseValStr.replace('FORMULA:', '');
          switch (formula) {
            case 'EDU': baseValue = characterData.stats.education || 0; break;
            case 'DEX': case 'DES': baseValue = characterData.stats.dexterity || 0; break;
            case 'INT': baseValue = characterData.stats.intelligence || 0; break;
            case 'POT': case 'POW': baseValue = characterData.stats.power || 0; break;
            default: baseValue = 0;
          }
        } else {
          baseValue = parseInt(baseValStr) || 0;
        }
      } else if (skillDef.base !== undefined) {
        baseValue = skillDef.base;
      }

      const currentValue = updatedSkills[skillName];
      const breakdown: SkillBreakdown = isGranularSkill(currentValue)
        ? { ...currentValue }
        : migrateSkillToGranular(skillName, getSkillTotal(currentValue), baseValue, occupation);

      // Apply occupation bonus (using DB bonusValue)
      breakdown.base = baseValue;
      breakdown.occupationBonus = bonusPoints;
      breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;

      updatedSkills[skillName] = breakdown;
    });

    return updatedSkills;
  };

  /**
   * Remove old occupation bonuses when changing occupation
   */
  const removeOccupationBonuses = (
    currentSkills: Record<string, number | SkillBreakdown>,
    oldOccupation: OccupationData
  ): Record<string, number | SkillBreakdown> => {
    const updatedSkills = { ...currentSkills };

    // Remove required skill bonuses
    // Only remove if isFixed=true (skill that was auto-applied)
    oldOccupation.requiredSkills?.forEach(requirement => {
      if (requirement.isFixed) {
        const skillName = requirement.skillName;
        const currentValue = updatedSkills[skillName];
        if (isGranularSkill(currentValue)) {
          const breakdown = { ...currentValue };
          breakdown.requiredBonus = 0;
          breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;
          updatedSkills[skillName] = breakdown;
        }
      }
      // If isFixed=false, nothing was auto-applied, so nothing to remove
    });

    // Remove bonus skill bonuses
    oldOccupation.bonusSkills?.forEach(bonusSkill => {
      const currentValue = updatedSkills[bonusSkill.skillName];
      if (isGranularSkill(currentValue)) {
        const breakdown = { ...currentValue };
        breakdown.occupationBonus = 0;
        breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;
        updatedSkills[bonusSkill.skillName] = breakdown;
      }
    });

    return updatedSkills;
  };

  /**
   * Reset all manual points when user chooses to reset on occupation change
   */
  const resetAllManualPoints = (
    currentSkills: Record<string, number | SkillBreakdown>
  ): Record<string, number | SkillBreakdown> => {
    const updatedSkills = { ...currentSkills };

    Object.entries(updatedSkills).forEach(([skillName, skillValue]) => {
      if (isGranularSkill(skillValue)) {
        const breakdown = { ...skillValue };
        breakdown.manualPoints = 0;
        breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;
        updatedSkills[skillName] = breakdown;
      }
    });

    return updatedSkills;
  };

  // Update character data and optionally save to localStorage
  const updateCharacterData = (updates: Partial<CharacterWizardData>, shouldSaveToLocalStorage: boolean = true): CharacterWizardData => {
    let newData = { ...characterData, ...updates };

    // If stats were updated, recalculate derived stats
    if (updates.stats) {
      newData.derived = calculateDerivedStats(newData.stats);
    }

    // Update validation using centralized system
    const newValidationResults = validateAllSteps(newData);
    setValidationResults(newValidationResults);

    // Update legacy validation states for backward compatibility
    const newInvalidSteps = new Set<number>();
    const newCompletedSteps = new Set(newData.completedSteps);

    Object.entries(newValidationResults).forEach(([stepId, result]) => {
      const id = parseInt(stepId);
      if (!result.isValid) {
        newInvalidSteps.add(id);
        newCompletedSteps.delete(id);
      } else {
        newCompletedSteps.add(id);
      }
    });

    newData.invalidSteps = newInvalidSteps;
    newData.completedSteps = newCompletedSteps;

    setCharacterData(newData);

    // Only save to localStorage (NOT server) during normal edits
    if (shouldSaveToLocalStorage) {
      saveToLocalStorage(newData);
    }

    return newData;
  };

  // Navigation functions - Review step only accessible if all previous steps are completed
  const goToStep = (step: number) => {
    if (step >= 1 && step <= WIZARD_STEPS.length) {
      // Block access to Review step (6) if any previous steps are invalid
      if (step === 6) {
        const hasInvalidSteps = [1, 2, 3, 4, 5].some(stepId => characterData.invalidSteps.has(stepId));
        if (hasInvalidSteps) {
          return; // Don't allow navigation to Review if previous steps are invalid
        }
      }
      setCurrentStep(step);
    }
  };

  const nextStep = async () => {
    if (currentStep < WIZARD_STEPS.length) {
      // FASE 5 - API INTEGRATION: Apply occupation bonuses when moving from Step 4 (Skills) to Step 5 (Background)
      if (currentStep === 4 && characterData.occupation && !characterData.occupationBonusesApplied) {
        try {
          console.log('🎯 Applying occupation bonuses...');

          const characterId = character?.id;
          if (!characterId) {
            throw new Error('Character ID not found');
          }

          // Call API to apply occupation bonuses
          const response = await fetch(`${API_BASE_URL}/game/characters/${characterId}/apply-occupation-bonuses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              occupationId: characterData.occupation?.id,
              selectedAlternatives: characterData.selectedAlternativeSkills || {}
            }),
            credentials: 'include'
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to apply occupation bonuses');
          }

          const result = await response.json();
          console.log('✅ Occupation bonuses applied:', result);

          // Reload character data to get updated skills with bonuses
          const reloadResponse = await fetch(`${API_BASE_URL}/game/characters/${characterId}`, {
            method: 'GET',
            credentials: 'include'
          });

          if (reloadResponse.ok) {
            const updatedCharacter = await reloadResponse.json();

            // Update local state with new skill values
            const updatedData = {
              ...characterData,
              skills: updatedCharacter.skills || characterData.skills,
              occupationBonusesApplied: true
            };

            updateCharacterData(updatedData, true);
            console.log('✅ Character data reloaded with applied bonuses');
          }

        } catch (error: any) {
          console.error('❌ Error applying occupation bonuses:', error);
          alert(`Errore durante l'applicazione dei bonus occupazione: ${error.message}\n\nPuoi comunque procedere, i bonus verranno applicati durante la revisione finale.`);
          // Allow progression even if bonus application fails - it will be attempted again during submission
        }
      }

      // Block progression to Review step (6) if any previous steps are invalid
      if (currentStep === 5) {
        const hasInvalidSteps = [1, 2, 3, 4, 5].some(stepId => characterData.invalidSteps.has(stepId));
        if (hasInvalidSteps) {
          return; // Don't allow progression to Review if previous steps are invalid
        }
      }

      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Submit character for approval
  const submitCharacter = async () => {
    try {
      const characterId = character?.id;
      if (!characterId) {
        throw new Error('Character ID not found');
      }

      // First, save the complete character data (filter empty fields) - NEW SYSTEM
      const baseCharacterUpdateData = {
        name: characterData.firstName,
        surname: characterData.lastName,
        birthDate: characterData.birthDate, // NEW: Data di nascita
        age: characterData.age,
        apparentAge: characterData.apparentAge,
        gender: characterData.gender,
        // NEW: Anagrafica completa
        height: characterData.height,
        weight: characterData.weight,
        eyeColor: characterData.eyeColor,
        hairColor: characterData.hairColor,
        visibleMarks: characterData.visibleMarks,
        hiddenMarks: characterData.hiddenMarks,
        maritalStatus: characterData.maritalStatus,
        illnesses: characterData.illnesses,
        educationTitle: characterData.educationTitle,
        criminalRecord: characterData.criminalRecord,
        // Stats
        stats: characterData.stats,
        derived: characterData.derived,
        skills: characterData.skills,
        // Occupation
        occupation: characterData.occupation?.id,
        occupationBonusesApplied: characterData.occupationBonusesApplied,
        selectedAlternativeSkills: characterData.selectedAlternativeSkills,
        // NEW: Background strutturato
        background: characterData.background,
        // Legacy fields (keep for compatibility)
        physicalDescription: characterData.physicalDescription,
        publicDescription: characterData.publicDescription,
        privateDescription: characterData.privateDescription,
        motivations: characterData.motivations,
        fears: characterData.fears
      };

      // Filter out empty fields
      const characterUpdateData = filterEmptyFields(baseCharacterUpdateData);

      // Save character data via API Gateway
      const updateResponse = await fetch(`${API_BASE_URL}/game/characters/${characterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(characterUpdateData),
        credentials: 'include' // Include cookies for authentication
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        
        // Handle validation errors with details
        if (errorData.code === 'CHARACTER_VALIDATION_ERROR' && errorData.details) {
          const validationErrors = Object.entries(errorData.details)
            .map(([field, message]) => `• ${message}`)
            .join('\n');
          throw new Error(`Errori di validazione:\n${validationErrors}`);
        }
        
        throw new Error(errorData.error || 'Failed to save character data');
      }

      // Then submit for approval via API Gateway
      const submitResponse = await fetch(`${API_BASE_URL}/game/characters/${characterId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies for authentication
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        
        // Handle validation errors with details
        if (errorData.code === 'CHARACTER_VALIDATION_ERROR' && errorData.details) {
          const validationErrors = Object.entries(errorData.details)
            .map(([field, message]) => `• ${message}`)
            .join('\n');
          throw new Error(`Errori di validazione:\n${validationErrors}`);
        }
        
        throw new Error(errorData.error || 'Failed to submit character for approval');
      }

      // Clear draft from localStorage
      localStorage.removeItem(`character-draft-${character?.id}`);
      
      // Update the character status in GameContext to reflect the change
      if (updateCharacter && character) {
        updateCharacter({
          ...character,
          status: 'PENDING_APPROVAL'
        });
      }
      
      // Redirect to pending approval page
      router.push('/?pending=true');
    } catch (error) {
      console.error('Failed to submit character:', error);
      alert(`Errore durante l'invio del personaggio: ${error instanceof Error ? error.message : 'Errore sconosciuto'}. Riprova.`);
    }
  };

  // Handler for Step 1 validation (lifted from component)
  // Wrapped in useCallback to prevent infinite render loops
  const handleStep1ValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    setValidationResults(prev => ({
      ...prev,
      1: {
        isValid,
        errors,
        warnings: []
      }
    }));
  }, []); // No dependencies - callback is stable

  // Render current step component
  const renderCurrentStep = () => {
    const stepConfig = WIZARD_STEPS[currentStep - 1];
    const StepComponent = stepConfig.component;
    const stepValidation = validationResults[currentStep];

    const commonProps = {
      characterData,
      updateCharacterData,
      onNext: nextStep,
      onPrev: prevStep,
      goToStep,
      onSubmit: submitCharacter,
      onManualSave: handleManualSave,
      isLastStep: currentStep === WIZARD_STEPS.length,
      validation: stepValidation,
      isStepValid: stepValidation?.isValid || false,
      validationErrors: stepValidation?.errors || [],
      validationWarnings: stepValidation?.warnings || [],
      pointsUsed: stepValidation?.pointsUsed,
      pointsTotal: stepValidation?.pointsTotal,
      pointsRemaining: stepValidation?.pointsRemaining,
      // Separated points tracking
      basePointsUsed: stepValidation?.basePointsUsed,
      basePointsTotal: stepValidation?.basePointsTotal,
      intPointsUsed: stepValidation?.intPointsUsed,
      intPointsTotal: stepValidation?.intPointsTotal,
      requiredPoints: stepValidation?.requiredPoints,
      bonusPoints: stepValidation?.bonusPoints
    };

    // Step 1 has local validation that we lift up
    if (currentStep === 1) {
      return (
        <StepComponent
          {...commonProps}
          onValidationChange={handleStep1ValidationChange}
        />
      );
    }

    return <StepComponent {...commonProps} />;
  };

  if (!character || character.status !== 'DRAFT') {
    return <div>Caricamento...</div>;
  }

  return (
      <div className={styles.wizardContainer}>
        {/* Header with progress */}
        <div className={styles.wizardHeader}>
          <h1 className={styles.wizardTitle}>Creazione Personaggio</h1>
          <div className={styles.characterInfo}>
            <span>Personaggio: <strong>{character.name}</strong></span>
            <span>Stato: <strong>BOZZA</strong></span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            {WIZARD_STEPS.map((step, index) => {
              // Check if Review step should be disabled
              const isReviewDisabled = step.id === 6 && [1, 2, 3, 4, 5].some(stepId => characterData.invalidSteps.has(stepId));
              
              return (
                <div
                  key={step.id}
                  className={`${styles.progressStep} ${
                    currentStep === step.id ? styles.active : ''
                  } ${
                    characterData.completedSteps.has(step.id) ? styles.completed : ''
                  } ${
                    characterData.invalidSteps.has(step.id) ? styles.invalid : ''
                  } ${!isReviewDisabled ? styles.clickable : styles.disabled}`}
                  onClick={() => !isReviewDisabled && goToStep(step.id)}
                  style={{ cursor: isReviewDisabled ? 'not-allowed' : 'pointer', opacity: isReviewDisabled ? 0.5 : 1 }}
                >
                <div className={styles.stepNumber}>
                  {characterData.completedSteps.has(step.id) 
                    ? '✓' 
                    : characterData.invalidSteps.has(step.id) 
                      ? '✗' 
                      : step.id
                  }
                </div>
                <div className={styles.stepTitle}>{step.title}</div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Current step content */}
        <div className={styles.stepContent}>
          {renderCurrentStep()}
        </div>

        {/* Navigation footer */}
        <div className={styles.wizardFooter}>
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={styles.prevButton}
          >
            ← Precedente
          </button>
          
          <div className={styles.stepIndicator}>
            Step {currentStep} di {WIZARD_STEPS.length}
          </div>
          
          {currentStep < WIZARD_STEPS.length ? (
            <button
              onClick={nextStep}
              className={styles.nextButton}
            >
              Successivo →
            </button>
          ) : (
            <button
              onClick={submitCharacter}
              className={styles.submitButton}
            >
              Invia per Approvazione
            </button>
          )}
        </div>
      </div>
  );
} 
