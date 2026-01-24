import React, { useEffect, useState } from 'react';
import {
  CharacterWizardData,
  isGranularSkill,
  getSkillTotal,
  getManualPoints,
  migrateSkillToGranular,
  SkillBreakdown
} from '@/pages/character/wizard';
import { useGame } from '@/contexts/GameContext';
import { calculateIntelligenceBonus } from '@/lib/intelligenceBonusFormula';
import styles from './WizardSteps.module.scss';

// Component for adding dynamic skills
interface AddDynamicSkillButtonProps {
  templateSkill: any;
  onAdd: (templateSkill: any, customValue: string) => void;
}

const AddDynamicSkillButton: React.FC<AddDynamicSkillButtonProps> = ({ templateSkill, onAdd }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // NEW: State per gestire select vs custom
  const hasPredefinedValues = templateSkill.predefinedValues?.length > 0;
  const [inputMode, setInputMode] = useState<'predefined' | 'custom'>(
    hasPredefinedValues ? 'predefined' : 'custom'
  );
  const [selectedPredefined, setSelectedPredefined] = useState('');

  const handleAdd = () => {
    let valueToAdd = '';

    if (inputMode === 'predefined') {
      if (!selectedPredefined) {
        alert('Seleziona un valore dalla lista');
        return;
      }
      valueToAdd = selectedPredefined;
    } else {
      const trimmed = customValue.trim();
      if (!trimmed) {
        alert('Inserisci un valore per la skill');
        return;
      }
      valueToAdd = trimmed;
    }

    onAdd(templateSkill, valueToAdd);
    setCustomValue('');
    setSelectedPredefined('');
    setIsAdding(false);
  };

  const handleCancel = () => {
    setCustomValue('');
    setSelectedPredefined('');
    setIsAdding(false);
    setInputMode(hasPredefinedValues ? 'predefined' : 'custom');
  };

  if (isAdding) {
    return (
      <div className={styles.addDynamicSkillForm}>
        {/* Mode selector - solo se ci sono predefinedValues */}
        {hasPredefinedValues && (
          <div className={styles.inputModeSelector}>
            <label className={styles.modeLabel}>
              <input
                type="radio"
                name={`mode-${templateSkill.id}`}
                value="predefined"
                checked={inputMode === 'predefined'}
                onChange={() => setInputMode('predefined')}
                className={styles.modeRadio}
              />
              <span>📋 Valori Suggeriti</span>
            </label>
            <label className={styles.modeLabel}>
              <input
                type="radio"
                name={`mode-${templateSkill.id}`}
                value="custom"
                checked={inputMode === 'custom'}
                onChange={() => setInputMode('custom')}
                className={styles.modeRadio}
              />
              <span>✏️ Personalizzato</span>
            </label>
          </div>
        )}

        {/* Input area */}
        <div className={styles.inputArea}>
          {inputMode === 'predefined' && hasPredefinedValues ? (
            // Dropdown per valori predefiniti
            <>
              <select
                value={selectedPredefined}
                onChange={(e) => setSelectedPredefined(e.target.value)}
                className={styles.predefinedSelect}
                autoFocus
              >
                <option value="">-- Seleziona --</option>
                {templateSkill.predefinedValues.map((value: string, index: number) => (
                  <option key={index} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <div className={styles.formActions}>
                <button onClick={handleAdd} className={styles.confirmAddButton} title="Conferma" type="button">
                  ✓ Aggiungi
                </button>
                <button onClick={handleCancel} className={styles.cancelAddButton} title="Annulla" type="button">
                  ✕ Annulla
                </button>
              </div>
            </>
          ) : (
            // Input libero
            <div className={styles.manualInput}>
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={`Inserisci ${templateSkill.placeholderType || 'valore'}...`}
                className={styles.dynamicSkillInput}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus={inputMode === 'custom'}
              />
              <button onClick={handleAdd} className={styles.confirmAddButton} title="Conferma" type="button">
                ✓
              </button>
              <button onClick={handleCancel} className={styles.cancelAddButton} title="Annulla" type="button">
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsAdding(true)}
      className={styles.addDynamicSkillButton}
      title={`Aggiungi ${templateSkill.name.toLowerCase()}`}
    >
      + Aggiungi {templateSkill.placeholderType || 'skill'}
    </button>
  );
};

// Import validation interface
interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  pointsUsed?: number;
  pointsTotal?: number;
  pointsRemaining?: number;
  // Separated points tracking
  basePointsUsed?: number;
  basePointsTotal?: number;
  intPointsUsed?: number;
  intPointsTotal?: number;
  requiredPoints?: number; // Skills richieste (obbligatorie, scalano dal budget)
  bonusPoints?: number;    // Skills bonus (GRATIS, non scalano dal budget)
}

interface WizardStep3Props {
  characterData: CharacterWizardData;
  updateCharacterData: (updates: Partial<CharacterWizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
  goToStep: (step: number) => void;
  onSubmit: () => void;
  onManualSave: () => void;
  isLastStep: boolean;
  // Centralized validation props
  validation?: StepValidationResult;
  isStepValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  pointsUsed?: number;
  pointsTotal?: number;
  pointsRemaining?: number;
  // Separated points tracking
  basePointsUsed?: number;
  basePointsTotal?: number;
  intPointsUsed?: number;
  intPointsTotal?: number;
  requiredPoints?: number; // Skills richieste (obbligatorie, scalano dal budget)
  bonusPoints?: number;    // Skills bonus (GRATIS, non scalano dal budget)
}

export const WizardStep3_Skills: React.FC<WizardStep3Props> = ({
  characterData,
  updateCharacterData,
  onNext,
  onPrev,
  onManualSave,
  // Centralized validation props
  isStepValid,
  validationErrors,
  validationWarnings,
  pointsUsed,
  pointsTotal,
  pointsRemaining,
  // Separated points tracking
  basePointsUsed,
  basePointsTotal,
  intPointsUsed,
  intPointsTotal,
  requiredPoints,
  bonusPoints
}) => {
  const { gameData } = useGame();

  // State for toggling occupation details visibility
  const [showOccupationDetails, setShowOccupationDetails] = useState(false);

  console.log('********************** pointsRemaining', {
    isStepValid,
    validationErrors,
    validationWarnings,
    pointsUsed,
    pointsTotal,
    pointsRemaining
  });

  // Extract character creation config from gameData
  const skillsConfig = gameData?.draftConfiguration?.characterCreationConfig?.skills;
  const socialClassesConfig = gameData?.draftConfiguration?.characterCreationConfig?.socialClasses || [];

  // Social class ranges from configuration
  const socialClassRanges = socialClassesConfig.length > 0 ? socialClassesConfig.map((sc: any) => ({
    min: sc.financeSkillRange.min,
    max: sc.financeSkillRange.max,
    name: sc.id,
    label: sc.name,
    weeklyCredit: sc.weeklyCredit,
    initialWealth: {
      minCash: sc.initialWealth.minCash,
      maxCash: sc.initialWealth.maxCash
    }
  })) : [
    // Fallback to defaults if config not available
    { min: 1, max: 9, name: 'destitute', label: 'Indigente', weeklyCredit: 2, initialWealth: { minCash: 5, maxCash: 15 } },
    { min: 10, max: 19, name: 'poor', label: 'Povero', weeklyCredit: 5, initialWealth: { minCash: 20, maxCash: 40 } },
    { min: 20, max: 39, name: 'modest', label: 'Modesto', weeklyCredit: 15, initialWealth: { minCash: 50, maxCash: 100 } },
    { min: 40, max: 49, name: 'lower_middle', label: 'Piccola borghesia', weeklyCredit: 30, initialWealth: { minCash: 150, maxCash: 300 } },
    { min: 50, max: 69, name: 'middle_class', label: 'Media borghesia', weeklyCredit: 75, initialWealth: { minCash: 400, maxCash: 800 } },
    { min: 70, max: 79, name: 'wealthy', label: 'Ricco', weeklyCredit: 150, initialWealth: { minCash: 1000, maxCash: 2000 } },
    { min: 80, max: 89, name: 'affluent', label: 'Facoltoso', weeklyCredit: 300, initialWealth: { minCash: 3000, maxCash: 5000 } },
    { min: 90, max: 99, name: 'elite', label: 'Élite', weeklyCredit: 500, initialWealth: { minCash: 8000, maxCash: 15000 } }
  ];

  // Calculate social class from FINANZA skill
  const calculateSocialClass = (finanzaValue: number) => {
    return socialClassRanges.find((range: { min: number; max: number }) => finanzaValue >= range.min && finanzaValue <= range.max) || socialClassRanges[0];
  };
  // Calculate skill points from config
  const calculateSkillPoints = (intelligence: number) => {
    const formula = skillsConfig?.totalPointsFormula || 'constant:200';
    let basePoints = 200;
    if (formula.startsWith('constant:')) {
      basePoints = parseInt(formula.replace('constant:', '')) || 200;
    }
    const intelligenceBonusFormula = skillsConfig?.intelligenceBonusFormula || 'INT/2';
    const intBonus = calculateIntelligenceBonus(intelligenceBonusFormula, intelligence);
    return basePoints + intBonus;
  };

  const maxSkillPoints = calculateSkillPoints(characterData.stats.intelligence || 50);

  // Extract base points for display
  const formula = skillsConfig?.totalPointsFormula || 'constant:200';
  let baseSkillPoints = 200;
  if (formula.startsWith('constant:')) {
    baseSkillPoints = parseInt(formula.replace('constant:', '')) || 200;
  }

  // Extract skill caps from config
  const skillCreationCap = skillsConfig?.creationCap || 75;
  const skillCreationCapWithOccupation = skillsConfig?.creationCapWithOccupation || 80;

  // 🔧 AUTO-ASSIGN manualPoints for mandatory skills on mount
  // This ensures that if a user returns to Step 3 with an occupation already selected,
  // the mandatory skills (without alternatives) are automatically filled
  // Logic: if alternatives array is empty or undefined, the skill is mandatory
  useEffect(() => {
    if (!characterData.occupation?.requiredSkills) return;

    const baseSkills = gameData?.draftConfiguration?.baseSkills || [];
    let needsUpdate = false;
    const updatedSkills = { ...characterData.skills };

    characterData.occupation.requiredSkills.forEach((requirement) => {
      // Only process skills without alternatives (mandatory skills)
      const hasNoAlternatives = !requirement.alternatives || requirement.alternatives.length === 0;
      if (!hasNoAlternatives) return;

      const skillName = requirement.skillName;
      const requiredMinimum = requirement.baseValue || 40;
      const skillDef = baseSkills.find((s: any) => s.name === skillName);
      if (!skillDef) return;

      // Calculate base value for this skill
      const calculateFormulaValue = (baseValue: string | number) => {
        if (typeof baseValue === 'string' && baseValue.startsWith('FORMULA:')) {
          const formula = baseValue.replace('FORMULA:', '');
          switch (formula) {
            case 'EDU': return characterData.stats.education || 0;
            case 'DEX': case 'DES': return characterData.stats.dexterity || 0;
            case 'INT': return characterData.stats.intelligence || 0;
            case 'POT': case 'POW': return characterData.stats.power || 0;
            case 'FOR': case 'STR': return characterData.stats.strength || 0;
            case 'COS': case 'CON': return characterData.stats.constitution || 0;
            case 'CHA': case 'APP': return characterData.stats.charm || 0;
            case 'TAG': case 'SIZ': return characterData.stats.size || 0;
            default: return 0;
          }
        }
        return typeof baseValue === 'string' ? parseInt(baseValue) || 0 : baseValue;
      };

      const baseValue = calculateFormulaValue(skillDef.baseValue);
      const currentValue = updatedSkills[skillName];

      // Check if the skill already has the required points
      const currentTotal = getSkillTotal(currentValue) || baseValue;
      if (currentTotal >= requiredMinimum) return; // Already satisfied

      // Auto-assign the missing points as manualPoints
      const breakdown: SkillBreakdown = isGranularSkill(currentValue)
        ? { ...currentValue }
        : migrateSkillToGranular(skillName, currentTotal, baseValue, characterData.occupation);

      breakdown.base = baseValue;
      const pointsNeeded = Math.max(0, requiredMinimum - breakdown.base);
      breakdown.manualPoints = pointsNeeded;
      breakdown.requiredBonus = 0;
      breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;

      updatedSkills[skillName] = breakdown;
      needsUpdate = true;
    });

    // Update character data if any skills were auto-assigned
    if (needsUpdate) {
      updateCharacterData({ skills: updatedSkills });
    }
  }, [characterData.occupation]); // Run when occupation changes or on mount

  const handleSkillChange = (skillName: string, manualPointsValue: number) => {
    const currentSkill = characterData.skills[skillName];
    const skillDef = baseSkills.find(s => s.name === skillName);
    if (!skillDef) return;

    // Calculate base value (handles formulas like FORMULA:EDU, etc.)
    const baseValue = calculateFormulaValue(skillDef.baseValue);

    // Convert to granular if needed
    const breakdown: SkillBreakdown = isGranularSkill(currentSkill)
      ? { ...currentSkill }
      : migrateSkillToGranular(skillName, currentSkill || baseValue, baseValue, characterData.occupation);

    // Update only manual points (user input)
    breakdown.manualPoints = Math.max(0, manualPointsValue);
    breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;

    updateCharacterData({
      skills: {
        ...characterData.skills,
        [skillName]: breakdown
      }
    });
  };

  // Handle dynamic skill changes
  const handleDynamicSkillChange = (skillName: string, manualPointsValue: number) => {
    const updatedDynamicSkills = characterData.dynamicSkills.map(ds => {
      if (ds.skillName !== skillName) return ds;

      // For dynamic skills, we also need granular tracking
      const currentSkill = characterData.skills[skillName];
      const baseValue = ds.value; // Dynamic skills have base value stored in dynamicSkill.value

      const breakdown: SkillBreakdown = isGranularSkill(currentSkill)
        ? { ...currentSkill }
        : migrateSkillToGranular(skillName, currentSkill || baseValue, baseValue, characterData.occupation);

      breakdown.manualPoints = Math.max(0, manualPointsValue);
      breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;

      // Update both dynamicSkills array and skills object
      updateCharacterData({
        skills: {
          ...characterData.skills,
          [skillName]: breakdown
        }
      });

      return { ...ds, value: breakdown.total };
    });
    updateCharacterData({ dynamicSkills: updatedDynamicSkills });
  };

  // Add new dynamic skill (e.g., Lingua (Francese))
  const handleAddDynamicSkill = (templateSkill: any, customValue: string) => {
    const skillName = `${templateSkill.name} (${customValue})`;

    // Check if this specific language already exists
    const existingSkill = characterData.dynamicSkills.find(
      ds => ds.skillName === skillName
    );

    if (existingSkill) {
      alert(`La skill "${skillName}" esiste già!`);
      return;
    }

    const newDynamicSkill = {
      skillName,
      basedOnTemplate: templateSkill.name,
      customValue,
      value: calculateFormulaValue(templateSkill.baseValue),
      category: templateSkill.category
    };

    updateCharacterData({
      dynamicSkills: [...characterData.dynamicSkills, newDynamicSkill]
    });
  };

  // Remove dynamic skill
  const handleRemoveDynamicSkill = (skillName: string) => {
    const updatedDynamicSkills = characterData.dynamicSkills.filter(
      ds => ds.skillName !== skillName
    );
    updateCharacterData({ dynamicSkills: updatedDynamicSkills });
  };

  // Removed local calculation functions - using centralized data

  // Removed local validation - using centralized validation

  // Get base skills from game data
  const baseSkills = gameData?.draftConfiguration?.baseSkills || [];

  // Get available skills - simple filtering without occupation logic
  const getAvailableSkills = () => {
    // Filter out placeholder skills from regular skills display
    const nonPlaceholderSkills = baseSkills.filter(skill => !(skill as any).isPlaceholder);
    const placeholderSkills = baseSkills.filter(skill => (skill as any).isPlaceholder);

    const availableSkills = nonPlaceholderSkills
      .filter(skill => skill.name !== 'Finanza')
      .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

    return {
      availableSkills,
      placeholderSkills: placeholderSkills.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999))
    };
  };

  const { availableSkills, placeholderSkills } = getAvailableSkills();

  // Group skills by category for organized display
  const groupSkillsByCategory = () => {
    const groups = {
      mentali: [] as any[],      // general
      arti: [] as any[],          // artistic + technical
      accademiche: [] as any[],   // knowledge
      sociali: [] as any[],       // social
      fisiche: [] as any[]        // physical + combat
    };

    availableSkills.forEach(skill => {
      const category = (skill as any).category;
      if (category === 'general') groups.mentali.push(skill);
      else if (category === 'artistic' || category === 'technical') groups.arti.push(skill);
      else if (category === 'knowledge') groups.accademiche.push(skill);
      else if (category === 'social') groups.sociali.push(skill);
      else if (category === 'physical' || category === 'combat') groups.fisiche.push(skill);
    });

    return groups;
  };

  const skillGroups = groupSkillsByCategory();

  // Check if skill is required by occupation
  const isSkillRequired = (skillName: string): boolean => {
    if (!characterData.occupation?.requiredSkills) return false;
    return characterData.occupation.requiredSkills.some(
      req => req.skillName === skillName ||
        req.alternatives?.some(alt => alt.skillName === skillName)
    );
  };

  // Check if skill is a bonus from occupation
  const isSkillBonus = (skillName: string): boolean => {
    if (!characterData.occupation?.bonusSkills) return false;
    return characterData.occupation.bonusSkills.some(bonus => bonus.skillName === skillName);
  };

  // Helper function to calculate base value for skills with formulas
  const calculateFormulaValue = (baseValue: string | number) => {
    if (typeof baseValue === 'string' && baseValue.startsWith('FORMULA:')) {
      const formula = baseValue.replace('FORMULA:', '');
      switch (formula) {
        case 'EDU':
          return characterData.stats.education || 0;
        case 'DEX':
        case 'DES':
          return characterData.stats.dexterity || 0;
        case 'INT':
          return characterData.stats.intelligence || 0;
        case 'POT':
        case 'POW':
          return characterData.stats.power || 0;
        case 'FOR':
        case 'STR':
          return characterData.stats.strength || 0;
        case 'COS':
        case 'CON':
          return characterData.stats.constitution || 0;
        case 'CHA':
        case 'APP':
          return characterData.stats.charm || 0;
        case 'TAG':
        case 'SIZ':
          return characterData.stats.size || 0;
        default:
          console.warn(`Unknown formula: ${formula}`);
          return 0;
      }
    }
    return typeof baseValue === 'string' ? parseInt(baseValue) || 0 : baseValue;
  };

  // Get minimum value for a skill based on base value only
  const getMinValueForSkill = (skillName: string) => {
    const skill = baseSkills.find(s => s.name === skillName);
    const baseValue = skill ? calculateFormulaValue(skill.baseValue) : 0;
    return baseValue;
  };

  // Cap for player-allocated skill points (from config)
  const getMaxValueForSkill = () => skillCreationCap;


  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Abilità e Situazione Finanziaria</h2>
        <p className={styles.stepDescription}>
          La tua abilità FINANZA determina la classe sociale, il patrimonio iniziale e la linea di credito settimanale del personaggio.
        </p>
      </div>

      {/* Skills Points Display - Sticky at top */}
      <div className={styles.skillsSummarySticky}>
        <div className={styles.skillsSummaryContent}>
          <div className={styles.summaryInfo}>
            {/* Occupation Summary */}
            {characterData.occupation && (
              <div className={styles.occupationSummary}>
                <div className={styles.occupationSummaryHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4>⚙️ Mestiere Selezionato</h4>
                    <button
                      onClick={() => setShowOccupationDetails(!showOccupationDetails)}
                      className={styles.toggleDetailsButton}
                      title={showOccupationDetails ? "Nascondi dettagli" : "Mostra dettagli"}
                      type="button"
                    >
                      {showOccupationDetails ? '▼' : '▶'}
                    </button>
                  </div>
                  <div className={styles.occupationName}>
                    <strong>{characterData.occupation.name}</strong>
                  </div>
                </div>

                {/* Required Skills */}
                {showOccupationDetails && (
                <div className={styles.occupationSummaryDetails}>
                  {characterData.occupation.requiredSkills && characterData.occupation.requiredSkills.length > 0 && (
                    <div className={styles.occupationSkillsSection}>
                      <div className={styles.occupationSkillsLabel}>
                        <strong>Abilità Richieste:</strong>
                      </div>
                      <div className={styles.occupationSkillsList}>
                        {characterData.occupation.requiredSkills.map((req: any, index: number) => (
                          <span key={index} className={styles.occupationSkillBadge}>
                            {req.skillName}
                            {req.alternatives && req.alternatives.length > 0 && (
                              <span className={styles.skillAlternatives}>
                                {' '}(o {req.alternatives.map((alt: any) => alt.skillName).join(', ')})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Bonus Skills */}
                {characterData.occupation.bonusSkills && characterData.occupation.bonusSkills.length > 0 && (
                  <div className={styles.occupationSkillsSection}>
                    <div className={styles.occupationSkillsLabel}>
                      <strong>Abilità Bonus:</strong>
                    </div>
                    <div className={styles.occupationSkillsList}>
                      {characterData.occupation.bonusSkills.map((bonus: any, index: number) => (
                        <span key={index} className={`${styles.occupationSkillBadge} ${styles.bonusBadge}`}>
                          {bonus.skillName} <span className={styles.bonusValue}>(+{bonus.bonusValue})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                </div>
                )}
              </div>
            )}

            <div>
              <h4>Riepilogo Punti Abilità</h4>
              <div className={styles.skillsInfo}>
                <small>Punti disponibili: {baseSkillPoints} + {calculateIntelligenceBonus(skillsConfig?.intelligenceBonusFormula || 'INT/2', characterData.stats.intelligence || 50)} (bonus INT) = {maxSkillPoints}</small>
                <small>Limite per singola abilità: {skillCreationCap}</small>
              </div>
            </div>
            <div>
              <div className={styles.pointsTracker}>
                {/* Separated points display */}
                <div className={styles.pointsRow}>
                  <span className={styles.pointsLabel}>Punti Base Usati:</span>
                  <span className={styles.pointsValue}>
                    {basePointsUsed || 0} / {basePointsTotal || baseSkillPoints}
                  </span>
                </div>
                <div className={styles.pointsRow}>
                  <span className={styles.pointsLabel}>Punti INT Usati:</span>
                  <span className={styles.pointsValue}>
                    {intPointsUsed || 0} / {intPointsTotal || 0}
                  </span>
                  <small className={styles.pointsHint}>
                    (non usabili per abilità fisiche)
                  </small>
                </div>
                <div className={styles.pointsRow}>
                  <span className={styles.pointsLabel}>Totale Rimanenti:</span>
                  <span className={`${styles.pointsValue} ${(pointsRemaining || 0) === 0 ? styles.pointsComplete : styles.pointsAvailable}`}>
                    {pointsRemaining || 0}
                  </span>
                </div>
                {/* Show validation errors */}
                {validationErrors.length > 0 && (
                  <div className={styles.validationErrors}>
                    {validationErrors.map((error, index) => (
                      <small key={index} className={styles.errorHint}>⚠️ {error}</small>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


        {validationErrors.length == 0 && (
          <div className={styles.bannerActions}>
            <button
              className={styles.saveButton}
              onClick={onManualSave}
              title="Salva la bozza"
            >
              💾 Salva
            </button>
            <button
              className={styles.nextStepButton}
              onClick={onNext}
              disabled={!isStepValid}
              title="Prosegui con il background"
            >
              Continua con il Background →
            </button>
          </div>
        )}
      </div>

      <div className={styles.skillsContainer}>
        {/* MENTALI Skills Section */}
        {skillGroups.mentali.length > 0 && (
          <div className={styles.skillsSection}>
            <h3 className={styles.sectionTitle}>Abilità Mentali</h3>
            <p className={styles.sectionDescription}>
              Abilità che richiedono concentrazione, intuito e capacità cognitive.
            </p>
            <div className={`${styles.skillsGrid} ${styles.skillsColumns}`}>
              {skillGroups.mentali.map((skill) => {
                const minValue = getMinValueForSkill(skill.name);
                const skillValue = characterData.skills[skill.name];
                const currentTotal = getSkillTotal(skillValue) || minValue;
                const currentManual = getManualPoints(skillValue);
                const required = isSkillRequired(skill.name);
                const bonus = isSkillBonus(skill.name);

                // Build breakdown text if granular
                let breakdownText = '';
                if (isGranularSkill(skillValue)) {
                  const parts = [];
                  if (skillValue.base > 0) parts.push(`${skillValue.base} base`);
                  if (skillValue.requiredBonus > 0) parts.push(`${skillValue.requiredBonus} required`);
                  if (skillValue.manualPoints > 0) parts.push(`${skillValue.manualPoints} manual`);
                  if (skillValue.occupationBonus > 0) parts.push(`${skillValue.occupationBonus} bonus`);
                  breakdownText = parts.join(' + ');
                }

                // Build detailed tooltip text
                const tooltipParts = [];
                if (isGranularSkill(skillValue)) {
                  tooltipParts.push(`Totale: ${skillValue.total}`);
                  tooltipParts.push(`Base: ${skillValue.base}`);
                  if (skillValue.requiredBonus > 0) {
                    tooltipParts.push(`Auto-applicato (richiesta): +${skillValue.requiredBonus}`);
                  }
                  if (skillValue.manualPoints > 0) {
                    tooltipParts.push(`Punti manuali: +${skillValue.manualPoints}`);
                  }
                  if (skillValue.occupationBonus > 0) {
                    tooltipParts.push(`Bonus occupazione: +${skillValue.occupationBonus}`);
                  }
                } else {
                  tooltipParts.push(`Valore: ${currentTotal}`);
                  tooltipParts.push(`Base: ${calculateFormulaValue(skill.baseValue)}`);
                }
                const detailTooltip = tooltipParts.join('\n');

                return (
                  <div key={skill.id} className={`${styles.skillGroup} ${required ? styles.requiredSkill : ''} ${bonus ? styles.bonusSkill : ''}`}>
                    <div className={styles.skillNameRow}>
                      <span className={styles.skillName} title={skill.description}>
                        {skill.name}
                      </span>
                      {/* Icona dettagli con tooltip completo */}
                      {(required || bonus || isGranularSkill(skillValue)) && (
                        <span className={styles.skillDetailsIcon} title={detailTooltip}>
                          {required && '⚙️'}
                          {bonus && !required && '⭐'}
                        </span>
                      )}
                    </div>
                    <div className={styles.skillValue}>
                      {/* Valore totale pulito */}
                      <strong className={styles.skillTotal}>{currentTotal}</strong>
                      {/* Input compatto */}
                      <input
                        type="number"
                        min={0}
                        max={skillCreationCap}
                        value={currentManual}
                        onChange={(e) => handleSkillChange(skill.name, parseInt(e.target.value) || 0)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ARTI E MESTIERI Skills Section */}
        {skillGroups.arti.length > 0 && (
          <div className={styles.skillsSection}>
            <h3 className={styles.sectionTitle}>Arti e Mestieri</h3>
            <p className={styles.sectionDescription}>
              Abilità creative, tecniche e artigianali.
            </p>
            <div className={`${styles.skillsGrid} ${styles.skillsColumns}`}>
              {skillGroups.arti.map((skill) => {
                const minValue = getMinValueForSkill(skill.name);
                const skillValue = characterData.skills[skill.name];
                const currentTotal = getSkillTotal(skillValue) || minValue;
                const currentManual = getManualPoints(skillValue);
                const required = isSkillRequired(skill.name);
                const bonus = isSkillBonus(skill.name);

                // Build breakdown text if granular
                let breakdownText = '';
                if (isGranularSkill(skillValue)) {
                  const parts = [];
                  if (skillValue.base > 0) parts.push(`${skillValue.base} base`);
                  if (skillValue.requiredBonus > 0) parts.push(`${skillValue.requiredBonus} required`);
                  if (skillValue.manualPoints > 0) parts.push(`${skillValue.manualPoints} manual`);
                  if (skillValue.occupationBonus > 0) parts.push(`${skillValue.occupationBonus} bonus`);
                  breakdownText = parts.join(' + ');
                }

                // Build detailed tooltip text
                const tooltipParts = [];
                if (isGranularSkill(skillValue)) {
                  tooltipParts.push(`Totale: ${skillValue.total}`);
                  tooltipParts.push(`Base: ${skillValue.base}`);
                  if (skillValue.requiredBonus > 0) {
                    tooltipParts.push(`Auto-applicato (richiesta): +${skillValue.requiredBonus}`);
                  }
                  if (skillValue.manualPoints > 0) {
                    tooltipParts.push(`Punti manuali: +${skillValue.manualPoints}`);
                  }
                  if (skillValue.occupationBonus > 0) {
                    tooltipParts.push(`Bonus occupazione: +${skillValue.occupationBonus}`);
                  }
                } else {
                  tooltipParts.push(`Valore: ${currentTotal}`);
                  tooltipParts.push(`Base: ${calculateFormulaValue(skill.baseValue)}`);
                }
                const detailTooltip = tooltipParts.join('\n');

                return (
                  <div key={skill.id} className={`${styles.skillGroup} ${required ? styles.requiredSkill : ''} ${bonus ? styles.bonusSkill : ''}`}>
                    <div className={styles.skillNameRow}>
                      <span className={styles.skillName} title={skill.description}>
                        {skill.name}
                      </span>
                      {/* Icona dettagli con tooltip completo */}
                      {(required || bonus || isGranularSkill(skillValue)) && (
                        <span className={styles.skillDetailsIcon} title={detailTooltip}>
                          {required && '⚙️'}
                          {bonus && !required && '⭐'}
                        </span>
                      )}
                    </div>
                    <div className={styles.skillValue}>
                      {/* Valore totale pulito */}
                      <strong className={styles.skillTotal}>{currentTotal}</strong>
                      {/* Input compatto */}
                      <input
                        type="number"
                        min={0}
                        max={skillCreationCap}
                        value={currentManual}
                        onChange={(e) => handleSkillChange(skill.name, parseInt(e.target.value) || 0)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ACCADEMICHE Skills Section */}
        {skillGroups.accademiche.length > 0 && (
          <div className={styles.skillsSection}>
            <h3 className={styles.sectionTitle}>Abilità Accademiche</h3>
            <p className={styles.sectionDescription}>
              Conoscenze specialistiche e scientifiche. <strong>Non</strong> possono essere usate senza aver speso punti.
            </p>
            <div className={`${styles.skillsGrid} ${styles.skillsColumns}`}>
              {skillGroups.accademiche.map((skill) => {
                const minValue = getMinValueForSkill(skill.name);
                const skillValue = characterData.skills[skill.name];
                const currentTotal = getSkillTotal(skillValue) || minValue;
                const currentManual = getManualPoints(skillValue);
                const required = isSkillRequired(skill.name);
                const bonus = isSkillBonus(skill.name);

                // Build breakdown text if granular
                let breakdownText = '';
                if (isGranularSkill(skillValue)) {
                  const parts = [];
                  if (skillValue.base > 0) parts.push(`${skillValue.base} base`);
                  if (skillValue.requiredBonus > 0) parts.push(`${skillValue.requiredBonus} required`);
                  if (skillValue.manualPoints > 0) parts.push(`${skillValue.manualPoints} manual`);
                  if (skillValue.occupationBonus > 0) parts.push(`${skillValue.occupationBonus} bonus`);
                  breakdownText = parts.join(' + ');
                }

                // Build detailed tooltip text
                const tooltipParts = [];
                if (isGranularSkill(skillValue)) {
                  tooltipParts.push(`Totale: ${skillValue.total}`);
                  tooltipParts.push(`Base: ${skillValue.base}`);
                  if (skillValue.requiredBonus > 0) {
                    tooltipParts.push(`Auto-applicato (richiesta): +${skillValue.requiredBonus}`);
                  }
                  if (skillValue.manualPoints > 0) {
                    tooltipParts.push(`Punti manuali: +${skillValue.manualPoints}`);
                  }
                  if (skillValue.occupationBonus > 0) {
                    tooltipParts.push(`Bonus occupazione: +${skillValue.occupationBonus}`);
                  }
                } else {
                  tooltipParts.push(`Valore: ${currentTotal}`);
                  tooltipParts.push(`Base: ${calculateFormulaValue(skill.baseValue)}`);
                }
                const detailTooltip = tooltipParts.join('\n');

                return (
                  <div key={skill.id} className={`${styles.skillGroup} ${required ? styles.requiredSkill : ''} ${bonus ? styles.bonusSkill : ''}`}>
                    <div className={styles.skillNameRow}>
                      <span className={styles.skillName} title={skill.description}>
                        {skill.name}
                      </span>
                      {/* Icona dettagli con tooltip completo */}
                      {(required || bonus || isGranularSkill(skillValue)) && (
                        <span className={styles.skillDetailsIcon} title={detailTooltip}>
                          {required && '⚙️'}
                          {bonus && !required && '⭐'}
                        </span>
                      )}
                    </div>
                    <div className={styles.skillValue}>
                      {/* Valore totale pulito */}
                      <strong className={styles.skillTotal}>{currentTotal}</strong>
                      {/* Input compatto */}
                      <input
                        type="number"
                        min={0}
                        max={skillCreationCap}
                        value={currentManual}
                        onChange={(e) => handleSkillChange(skill.name, parseInt(e.target.value) || 0)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SOCIALI Skills Section */}
        {skillGroups.sociali.length > 0 && (
          <div className={styles.skillsSection}>
            <h3 className={styles.sectionTitle}>Abilità Sociali</h3>
            <p className={styles.sectionDescription}>
              Abilità di interazione, persuasione e comprensione del comportamento umano.
            </p>
            <div className={`${styles.skillsGrid} ${styles.skillsColumns}`}>
              {skillGroups.sociali.map((skill) => {
                const minValue = getMinValueForSkill(skill.name);
                const skillValue = characterData.skills[skill.name];
                const currentTotal = getSkillTotal(skillValue) || minValue;
                const currentManual = getManualPoints(skillValue);
                const required = isSkillRequired(skill.name);
                const bonus = isSkillBonus(skill.name);

                // Build breakdown text if granular
                let breakdownText = '';
                if (isGranularSkill(skillValue)) {
                  const parts = [];
                  if (skillValue.base > 0) parts.push(`${skillValue.base} base`);
                  if (skillValue.requiredBonus > 0) parts.push(`${skillValue.requiredBonus} required`);
                  if (skillValue.manualPoints > 0) parts.push(`${skillValue.manualPoints} manual`);
                  if (skillValue.occupationBonus > 0) parts.push(`${skillValue.occupationBonus} bonus`);
                  breakdownText = parts.join(' + ');
                }

                // Build detailed tooltip text
                const tooltipParts = [];
                if (isGranularSkill(skillValue)) {
                  tooltipParts.push(`Totale: ${skillValue.total}`);
                  tooltipParts.push(`Base: ${skillValue.base}`);
                  if (skillValue.requiredBonus > 0) {
                    tooltipParts.push(`Auto-applicato (richiesta): +${skillValue.requiredBonus}`);
                  }
                  if (skillValue.manualPoints > 0) {
                    tooltipParts.push(`Punti manuali: +${skillValue.manualPoints}`);
                  }
                  if (skillValue.occupationBonus > 0) {
                    tooltipParts.push(`Bonus occupazione: +${skillValue.occupationBonus}`);
                  }
                } else {
                  tooltipParts.push(`Valore: ${currentTotal}`);
                  tooltipParts.push(`Base: ${calculateFormulaValue(skill.baseValue)}`);
                }
                const detailTooltip = tooltipParts.join('\n');

                return (
                  <div key={skill.id} className={`${styles.skillGroup} ${required ? styles.requiredSkill : ''} ${bonus ? styles.bonusSkill : ''}`}>
                    <div className={styles.skillNameRow}>
                      <span className={styles.skillName} title={skill.description}>
                        {skill.name}
                      </span>
                      {/* Icona dettagli con tooltip completo */}
                      {(required || bonus || isGranularSkill(skillValue)) && (
                        <span className={styles.skillDetailsIcon} title={detailTooltip}>
                          {required && '⚙️'}
                          {bonus && !required && '⭐'}
                        </span>
                      )}
                    </div>
                    <div className={styles.skillValue}>
                      {/* Valore totale pulito */}
                      <strong className={styles.skillTotal}>{currentTotal}</strong>
                      {/* Input compatto */}
                      <input
                        type="number"
                        min={0}
                        max={skillCreationCap}
                        value={currentManual}
                        onChange={(e) => handleSkillChange(skill.name, parseInt(e.target.value) || 0)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FISICHE Skills Section */}
        {skillGroups.fisiche.length > 0 && (
          <div className={styles.skillsSection}>
            <h3 className={styles.sectionTitle}>Abilità Fisiche</h3>
            <p className={styles.sectionDescription}>
              Abilità di combattimento, movimento e coordinazione fisica. <strong>I punti INT non possono essere usati su queste abilità.</strong>
            </p>
            <div className={`${styles.skillsGrid} ${styles.skillsColumns}`}>
              {skillGroups.fisiche.map((skill) => {
                const minValue = getMinValueForSkill(skill.name);
                const skillValue = characterData.skills[skill.name];
                const currentTotal = getSkillTotal(skillValue) || minValue;
                const currentManual = getManualPoints(skillValue);
                const required = isSkillRequired(skill.name);
                const bonus = isSkillBonus(skill.name);

                // Build breakdown text if granular
                let breakdownText = '';
                if (isGranularSkill(skillValue)) {
                  const parts = [];
                  if (skillValue.base > 0) parts.push(`${skillValue.base} base`);
                  if (skillValue.requiredBonus > 0) parts.push(`${skillValue.requiredBonus} required`);
                  if (skillValue.manualPoints > 0) parts.push(`${skillValue.manualPoints} manual`);
                  if (skillValue.occupationBonus > 0) parts.push(`${skillValue.occupationBonus} bonus`);
                  breakdownText = parts.join(' + ');
                }

                // Build detailed tooltip text
                const tooltipParts = [];
                if (isGranularSkill(skillValue)) {
                  tooltipParts.push(`Totale: ${skillValue.total}`);
                  tooltipParts.push(`Base: ${skillValue.base}`);
                  if (skillValue.requiredBonus > 0) {
                    tooltipParts.push(`Auto-applicato (richiesta): +${skillValue.requiredBonus}`);
                  }
                  if (skillValue.manualPoints > 0) {
                    tooltipParts.push(`Punti manuali: +${skillValue.manualPoints}`);
                  }
                  if (skillValue.occupationBonus > 0) {
                    tooltipParts.push(`Bonus occupazione: +${skillValue.occupationBonus}`);
                  }
                } else {
                  tooltipParts.push(`Valore: ${currentTotal}`);
                  tooltipParts.push(`Base: ${calculateFormulaValue(skill.baseValue)}`);
                }
                const detailTooltip = tooltipParts.join('\n');

                return (
                  <div key={skill.id} className={`${styles.skillGroup} ${styles.physicalSkill} ${required ? styles.requiredSkill : ''} ${bonus ? styles.bonusSkill : ''}`}>
                    <div className={styles.skillNameRow}>
                      <span className={styles.skillName} title={skill.description}>
                        {skill.name}
                      </span>
                      {/* Icona dettagli con tooltip completo */}
                      {(required || bonus || isGranularSkill(skillValue)) && (
                        <span className={styles.skillDetailsIcon} title={detailTooltip}>
                          {required && '⚙️'}
                          {bonus && !required && '⭐'}
                        </span>
                      )}
                    </div>
                    <div className={styles.skillValue}>
                      {/* Valore totale pulito */}
                      <strong className={styles.skillTotal}>{currentTotal}</strong>
                      {/* Input compatto */}
                      <input
                        type="number"
                        min={0}
                        max={skillCreationCap}
                        value={currentManual}
                        onChange={(e) => handleSkillChange(skill.name, parseInt(e.target.value) || 0)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Skills Section */}
        {placeholderSkills.length > 0 && (
          <div className={styles.skillsSection}>
            <h3 className={styles.sectionTitle}>Abilità Personalizzabili</h3>
            <p className={styles.sectionDescription}>
              Aggiungi abilità specifiche come lingue straniere. Clicca "+ Aggiungi" per aggiungerne una nuova.
            </p>

            {placeholderSkills.map((placeholderSkill) => {
              const isRequired = isSkillRequired(placeholderSkill.name);
              const currentCount = characterData.dynamicSkills.filter(ds => ds.basedOnTemplate === placeholderSkill.name).length;

              return (
                <div key={placeholderSkill.id} className={`${styles.placeholderSkillGroup} ${isRequired ? styles.requiredSkill : ''}`}>
                  <div className={styles.placeholderHeader}>
                    <h4 className={styles.placeholderSkillName} title={placeholderSkill.description}>
                      {placeholderSkill.name}
                      {isRequired && <span className={styles.requiredBadge} title="Richiesta dall'occupazione">⚙️</span>}
                      {currentCount > 0 && <span className={styles.countBadge}>{currentCount}</span>}
                    </h4>
                    <AddDynamicSkillButton
                      templateSkill={placeholderSkill}
                      onAdd={handleAddDynamicSkill}
                    />
                  </div>

                  {/* Show existing dynamic skills for this placeholder */}
                  {currentCount > 0 && (
                    <div className={styles.dynamicSkillsGrid}>
                      {characterData.dynamicSkills
                        .filter(ds => ds.basedOnTemplate === placeholderSkill.name)
                        .map((dynamicSkill) => (
                          <div key={dynamicSkill.skillName} className={styles.dynamicSkillCard}>
                            <div className={styles.dynamicSkillCardHeader}>
                              <span className={styles.dynamicSkillCardName} title={dynamicSkill.skillName}>
                                {dynamicSkill.customValue}
                              </span>
                              <button
                                onClick={() => handleRemoveDynamicSkill(dynamicSkill.skillName)}
                                className={styles.removeDynamicSkillButton}
                                title="Rimuovi questa abilità"
                              >
                                ×
                              </button>
                            </div>
                            <div className={styles.skillValue}>
                              {(() => {
                                const skillValue = characterData.skills[dynamicSkill.skillName];
                                const currentTotal = getSkillTotal(skillValue) || calculateFormulaValue(placeholderSkill.baseValue);
                                const currentManual = getManualPoints(skillValue);

                                // Build detailed tooltip text
                                const tooltipParts = [];
                                if (isGranularSkill(skillValue)) {
                                  tooltipParts.push(`Totale: ${skillValue.total}`);
                                  tooltipParts.push(`Base: ${skillValue.base}`);
                                  if (skillValue.requiredBonus > 0) {
                                    tooltipParts.push(`Auto-applicato (richiesta): +${skillValue.requiredBonus}`);
                                  }
                                  if (skillValue.manualPoints > 0) {
                                    tooltipParts.push(`Punti manuali: +${skillValue.manualPoints}`);
                                  }
                                  if (skillValue.occupationBonus > 0) {
                                    tooltipParts.push(`Bonus occupazione: +${skillValue.occupationBonus}`);
                                  }
                                } else {
                                  tooltipParts.push(`Valore: ${currentTotal}`);
                                  tooltipParts.push(`Base: ${calculateFormulaValue(placeholderSkill.baseValue)}`);
                                }
                                const detailTooltip = tooltipParts.join('\n');

                                return (
                                  <>
                                    <div className={styles.skillValueRow}>
                                      {/* Valore totale pulito */}
                                      <strong className={styles.skillTotal}>{currentTotal}</strong>
                                      {/* Icona dettagli con tooltip */}
                                      {isGranularSkill(skillValue) && (
                                        <span className={styles.skillDetailsIcon} title={detailTooltip}>
                                          ⚙️
                                        </span>
                                      )}
                                    </div>
                                    {/* Input compatto */}
                                    <input
                                      type="number"
                                      min={0}
                                      max={skillCreationCap}
                                      value={currentManual}
                                      onChange={(e) => handleDynamicSkillChange(
                                        dynamicSkill.skillName,
                                        parseInt(e.target.value) || 0
                                      )}
                                      className={styles.input}
                                      placeholder="0"
                                    />
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FINANZA Skills Section - At the end as requested */}
        <div className={`${styles.skillsSection} ${styles.finanzaSection}`}>
          <h3 className={styles.sectionTitle}>Situazione Finanziaria (FINANZA)</h3>
          <p className={styles.sectionDescription}>
            L'abilità FINANZA è fondamentale e determina automaticamente la tua classe sociale e situazione economica.
          </p>

          {(() => {
            const finanzaSkill = baseSkills.find(s => s.name === 'Finanza');
            if (!finanzaSkill) {
              return (
                <div className={styles.finanzaError}>
                  ⚠️ Skill FINANZA non trovata nel database. Contattare il supporto.
                </div>
              );
            }

            const minValue = getMinValueForSkill(finanzaSkill.name);
            const skillValue = characterData.skills[finanzaSkill.name];
            const currentTotal = getSkillTotal(skillValue) || minValue;
            const currentManual = getManualPoints(skillValue);
            const socialClass = calculateSocialClass(currentTotal);

            // Build detailed tooltip text
            const tooltipParts = [];
            if (isGranularSkill(skillValue)) {
              tooltipParts.push(`Totale: ${skillValue.total}`);
              tooltipParts.push(`Base: ${skillValue.base}`);
              if (skillValue.requiredBonus > 0) {
                tooltipParts.push(`Auto-applicato (richiesta): +${skillValue.requiredBonus}`);
              }
              if (skillValue.manualPoints > 0) {
                tooltipParts.push(`Punti manuali: +${skillValue.manualPoints}`);
              }
              if (skillValue.occupationBonus > 0) {
                tooltipParts.push(`Bonus occupazione: +${skillValue.occupationBonus}`);
              }
            } else {
              tooltipParts.push(`Valore: ${currentTotal}`);
              tooltipParts.push(`Base: ${calculateFormulaValue(finanzaSkill.baseValue)}`);
            }
            const detailTooltip = tooltipParts.join('\n');

            const required = isSkillRequired(finanzaSkill.name);
            const bonus = isSkillBonus(finanzaSkill.name);

            return (
              <div className={styles.finanzaContainer}>
                {/* FINANZA Skill Input */}
                <div className={styles.finanzaSkillInput}>
                  <div className={styles.skillGroup}>
                    <div className={styles.skillNameRow}>
                      <span className={styles.skillName} title={finanzaSkill.description}>
                        {finanzaSkill.name}
                      </span>
                      {/* Icona dettagli con tooltip completo */}
                      {(required || bonus || isGranularSkill(skillValue)) && (
                        <span className={styles.skillDetailsIcon} title={detailTooltip}>
                          {required && '⚙️'}
                          {bonus && !required && '⭐'}
                          {!required && !bonus && isGranularSkill(skillValue) && '⚙️'}
                        </span>
                      )}
                    </div>
                    <div className={styles.skillValue}>
                      {/* Valore totale pulito */}
                      <strong className={styles.skillTotal}>{currentTotal}</strong>
                      {/* Input compatto */}
                      <input
                        type="number"
                        min={0}
                        max={skillCreationCap}
                        value={currentManual}
                        onChange={(e) => handleSkillChange(finanzaSkill.name, parseInt(e.target.value) || 0)}
                        className={`${styles.input} ${styles.finanzaInput}`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Social Class Preview */}
                <div className={styles.socialClassPreview}>
                  <h4>Situazione Finanziaria Attuale</h4>
                  <div className={styles.socialClassCard}>
                    <div className={styles.socialClassName}>
                      <strong>Classe Sociale: {socialClass.label}</strong>
                    </div>
                    <div className={styles.socialClassDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Contante Iniziale:</span>
                        <span className={styles.detailValue}>
                          £{socialClass.initialWealth.minCash} - £{socialClass.initialWealth.maxCash}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span
                          className={styles.detailLabel}
                          title="La linea di credito permette acquisti posticipati fino al limite settimanale (reset domenica)"
                        >
                          Linea di Credito Settimanale:
                        </span>
                        <span
                          className={styles.detailValue}
                          title="La linea di credito permette acquisti posticipati fino al limite settimanale (reset domenica)"
                        >
                          £{socialClass.weeklyCredit}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Range Abilità:</span>
                        <span className={styles.detailValue}>{socialClass.min}-{socialClass.max}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className={styles.stepNavigation}>
        <button onClick={onPrev} className={styles.prevButton}>
          ← Torna alle Caratteristiche
        </button>

        <button
          onClick={onManualSave}
          className={`${styles.saveButton} manual-save-button`}
        >
          💾 SALVA
        </button>

        <button
          onClick={onNext}
          disabled={!isStepValid}
          className={styles.nextButton}
        >
          Continua con il Background →
        </button>
      </div>
    </div>
  );
};