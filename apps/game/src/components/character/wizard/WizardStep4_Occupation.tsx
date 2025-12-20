import React, { useEffect, useState } from 'react';
import {
  CharacterWizardData,
  isGranularSkill,
  getSkillTotal,
  migrateSkillToGranular,
  SkillBreakdown
} from '@/pages/character/wizard';
import { useGame } from '@/contexts/GameContext';
import styles from './WizardSteps.module.scss';

interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface WizardStep4Props {
  characterData: CharacterWizardData;
  updateCharacterData: (updates: Partial<CharacterWizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
  goToStep: (step: number) => void;
  onSubmit: () => void;
  onManualSave: () => void;
  isLastStep: boolean;
  validation?: StepValidationResult;
  isStepValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
}

// Occupation data structure (aligned with database model)
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
  workingConditions?: string;
  rarity?: string;
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
  // API may include these legacy fields
  prerequisites?: any;
  benefits?: any;
}

export const WizardStep4_Occupation: React.FC<WizardStep4Props> = ({
  characterData,
  updateCharacterData,
  onNext,
  onPrev,
  onManualSave,
  isStepValid,
  validationErrors,
  validationWarnings
}) => {
  const { gameData } = useGame();
  const [availableOccupations, setAvailableOccupations] = useState<OccupationData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showResetPopup, setShowResetPopup] = useState(false);
  const [pendingOccupation, setPendingOccupation] = useState<OccupationData | null>(null);

  // Environment variables for parametric values
  const REQUIRED_SKILL_MINIMUM = parseInt(
    process.env.NEXT_PUBLIC_OCCUPATION_REQUIRED_SKILL_MINIMUM || '40'
  );
  const BONUS_SKILL_POINTS = parseInt(
    process.env.NEXT_PUBLIC_OCCUPATION_BONUS_SKILL_POINTS || '30'
  );

  useEffect(() => {
    // Get occupations from game data
    const baseOccupations = gameData?.draftConfiguration?.baseOccupations || [];

    // Sort alphabetically by name only
    const sorted = baseOccupations.sort((a, b) =>
      a.name.localeCompare(b.name, 'it')
    );

    setAvailableOccupations(sorted);
  }, [gameData]);

  // Helper functions for granular skill tracking
  const applyRequiredSkillsAuto = (
    newOccupation: OccupationData,
    currentSkills: Record<string, number | SkillBreakdown>
  ): Record<string, number | SkillBreakdown> => {
    const updatedSkills = { ...currentSkills };
    const availableSkills = gameData?.draftConfiguration?.baseSkills || [];

    newOccupation.requiredSkills?.forEach(requirement => {
      // Use baseValue from requirement (from DB), or fallback to environment variable
      const requiredMinimum = requirement.baseValue || REQUIRED_SKILL_MINIMUM;

      // ✅ AUTO-ASSIGN manualPoints if NO alternatives exist (mandatory skill)
      // Logic: if alternatives array is empty or undefined, the skill is mandatory without choice
      // If alternatives exist, the user must manually choose which alternative skill to develop
      const hasNoAlternatives = !requirement.alternatives || requirement.alternatives.length === 0;

      if (hasNoAlternatives) {
        const skillName = requirement.skillName;
        const skillDef = availableSkills.find((s: any) => s.name === skillName);
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
        }

        const currentValue = updatedSkills[skillName];
        const breakdown: SkillBreakdown = isGranularSkill(currentValue)
          ? { ...currentValue }
          : migrateSkillToGranular(skillName, getSkillTotal(currentValue), baseValue, newOccupation);

        breakdown.base = baseValue;

        // 🔧 AUTO-ASSIGN manualPoints for mandatory skills (user convenience)
        // Since the skill has no alternatives, we automatically set it to the required minimum
        const pointsNeeded = Math.max(0, requiredMinimum - breakdown.base);
        breakdown.manualPoints = pointsNeeded;
        breakdown.requiredBonus = 0; // No need for requiredBonus since we're using manualPoints
        breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;

        updatedSkills[skillName] = breakdown;
      }
      // If alternatives exist, DON'T process automatically
      // The user must manually allocate points to ONE of the alternative skills
    });

    return updatedSkills;
  };

  const applyOccupationBonusesGranular = (
    occupation: OccupationData,
    currentSkills: Record<string, number | SkillBreakdown>
  ): Record<string, number | SkillBreakdown> => {
    const updatedSkills = { ...currentSkills };
    const availableSkills = gameData?.draftConfiguration?.baseSkills || [];

    occupation.bonusSkills?.forEach(bonusSkill => {
      const skillName = bonusSkill.skillName;
      const skillDef = availableSkills.find((s: any) => s.name === skillName);
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
      }

      const currentValue = updatedSkills[skillName];
      const breakdown: SkillBreakdown = isGranularSkill(currentValue)
        ? { ...currentValue }
        : migrateSkillToGranular(skillName, getSkillTotal(currentValue), baseValue, occupation);

      breakdown.base = baseValue;
      breakdown.occupationBonus = BONUS_SKILL_POINTS;
      breakdown.total = breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;

      updatedSkills[skillName] = breakdown;
    });

    return updatedSkills;
  };

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

  const applyOccupationChange = (occupation: OccupationData, resetManual: boolean) => {
    let updatedSkills = { ...characterData.skills };

    // Remove old occupation bonuses
    if (characterData.occupation) {
      updatedSkills = removeOccupationBonuses(updatedSkills, characterData.occupation);
    }

    // Reset manual points if requested
    if (resetManual) {
      updatedSkills = resetAllManualPoints(updatedSkills);
    }

    // Apply required skills (auto to minimum)
    updatedSkills = applyRequiredSkillsAuto(occupation, updatedSkills);

    // Apply bonus skills immediately
    updatedSkills = applyOccupationBonusesGranular(occupation, updatedSkills);

    updateCharacterData({
      occupation,
      skills: updatedSkills
    });

    setShowResetPopup(false);
    setPendingOccupation(null);
  };

  const handleOccupationSelect = (occupation: OccupationData) => {
    // Check if there are manual points allocated
    const hasManualPoints = Object.values(characterData.skills).some(skill => {
      if (isGranularSkill(skill)) {
        return skill.manualPoints > 0;
      }
      return false;
    });

    // If changing occupation and has manual points, show popup
    if (characterData.occupation && hasManualPoints) {
      setShowResetPopup(true);
      setPendingOccupation(occupation);
      return;
    }

    // Apply occupation immediately
    applyOccupationChange(occupation, false);
  };

  // Get unique categories for filtering and sort alphabetically
  const categories = Array.from(new Set(availableOccupations.map(o => o.category))).sort((a, b) =>
    a.localeCompare(b, 'it')
  );

  // Filter occupations by selected category
  const filteredOccupations = selectedCategory === 'all'
    ? availableOccupations
    : availableOccupations.filter(o => o.category === selectedCategory);

  // Category labels in Italian (18 categories)
  const categoryLabels: Record<string, string> = {
    'avventurieri': 'Avventurieri',
    'arti_creative': 'Arti Creative',
    'artisti_spettacolo': 'Artisti dello Spettacolo',
    'sport': 'Sport',
    'affari': 'Affari',
    'religiosi': 'Religiosi',
    'criminali': 'Criminali',
    'giornalismo': 'Giornalismo',
    'lavoro_rurale': 'Lavoro Rurale',
    'lavoro_urbano': 'Lavoro Urbano',
    'tutori_ordine': 'Tutori dell\'Ordine',
    'professione_legale': 'Professione Legale',
    'operatori_sanitari': 'Operatori Sanitari',
    'salute_mentale': 'Salute Mentale',
    'forze_armate': 'Forze Armate',
    'politica': 'Politica',
    'studiosi': 'Studiosi',
    'professioni_varie': 'Professioni Varie'
  };

  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Esperienze Pregresse</h2>
        <p className={styles.stepDescription}>
          Scegli l'occupazione o esperienza pregressa che ha definito la vita del tuo personaggio fino ad ora.
          Questa scelta influenzerà il background e le conoscenze del personaggio.
        </p>
      </div>

      {/* Category Filter */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Filtra per Categoria</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={styles.select}
        >
          <option value="all">Tutte le Categorie</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {categoryLabels[cat] || cat}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Occupation Display */}
      {characterData.occupation && (
        <div className={styles.selectedOccupation}>
          <h3>✓ Esperienza Selezionata: {characterData.occupation.name}</h3>
        </div>
      )}

      {/* Occupations Grid */}
      <div className={styles.occupationsGrid}>
        {filteredOccupations.map((occupation) => {
          const isSelected = characterData.occupation?.id === occupation.id;

          return (
            <div
              key={occupation.id}
              className={`${styles.occupationCard} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleOccupationSelect(occupation)}
            >
              <div className={styles.occupationHeader}>
                <h4 className={styles.occupationName}>{occupation.name}</h4>
                <span className={styles.occupationCategory}>
                  {categoryLabels[occupation.category] || occupation.category}
                </span>
              </div>

              <p className={styles.occupationDescription}>{occupation.description}</p>

              <div className={styles.occupationDetails}>
                <div className={styles.detailRow}>
                  <strong>Contatti:</strong>
                  <span>{occupation.contacts}</span>
                </div>

                <div className={styles.detailRow}>
                  <strong>Guadagni:</strong>
                  <span>{occupation.earnings}</span>
                </div>

                {/* Requisiti - Required skills for this occupation */}
                {occupation.requiredSkills && occupation.requiredSkills.length > 0 && (
                  <div className={styles.detailRow}>
                    <strong>Requisiti:</strong>
                    <span>{occupation.requiredSkills.map(req => req.skillName).join(', ')}</span>
                  </div>
                )}

                {/* Bonus - Bonus skill granted by this occupation */}
                {occupation.bonusSkills && occupation.bonusSkills.length > 0 && (
                  <div className={styles.detailRow}>
                    <strong>Bonus:</strong>
                    <span>{occupation.bonusSkills.map(bonus => `${bonus.skillName} (+${bonus.bonusValue})`).join(', ')}</span>
                  </div>
                )}
              </div>

              {isSelected && (
                <div className={styles.selectedBadge}>
                  ✓ SELEZIONATA
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Validation Messages */}
      {!isStepValid && validationErrors.length > 0 && (
        <div className={styles.validationError}>
          <p className={styles.errorTitle}>⚠️ Errori di Validazione:</p>
          <ul>
            {validationErrors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className={styles.validationWarning}>
          <p>💡 Avvisi:</p>
          <ul>
            {validationWarnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation */}
      <div className={styles.stepNavigation}>
        <button onClick={onPrev} className={styles.prevButton}>
          ← Torna alle Informazioni Base
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
          Continua con le Caratteristiche →
        </button>
      </div>

      {/* Occupation Change Popup */}
      {showResetPopup && pendingOccupation && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupDialog}>
            <h3 className={styles.popupTitle}>Cambio Esperienza Pregressa</h3>
            <p className={styles.popupText}>
              Stai cambiando da "<strong>{characterData.occupation?.name}</strong>" a
              "<strong>{pendingOccupation.name}</strong>".
            </p>
            <p className={styles.popupText}>
              Hai già allocato punti abilità manualmente. Vuoi resettare le abilità allocate?
            </p>
            <div className={styles.popupActions}>
              <button
                onClick={() => applyOccupationChange(pendingOccupation, true)}
                className={styles.popupBtnPrimary}
              >
                Sì, resetta le abilità
              </button>
              <button
                onClick={() => applyOccupationChange(pendingOccupation, false)}
                className={styles.popupBtnSecondary}
              >
                No, mantieni le abilità
              </button>
              <button
                onClick={() => {
                  setShowResetPopup(false);
                  setPendingOccupation(null);
                }}
                className={styles.popupBtnGhost}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
