import React from 'react';
import { CharacterWizardData } from '@/pages/character/wizard';
import { useGame } from '@/contexts/GameContext';
import styles from './WizardSteps.module.scss';

// Import validation interface
interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  pointsUsed?: number;
  pointsTotal?: number;
  pointsRemaining?: number;
}

// Occupation requirement interface (for type safety, even though always empty in Step 2)
interface OccupationRequirement {
  statName: keyof CharacterWizardData['stats'];
  minValue: number;
  currentValue: number;
  isValid: boolean;
}

interface WizardStep2Props {
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
}

export const WizardStep2_Stats: React.FC<WizardStep2Props> = ({
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
  pointsRemaining
}) => {
  const { gameData } = useGame();

  // Get stats config from character creation config
  const statsConfig = gameData?.draftConfiguration?.characterCreationConfig?.stats;
  const maxStatPoints = statsConfig?.totalPoints || 400;
  const basePoints = statsConfig?.basePoints || 20;
  const statCreationCap = statsConfig?.creationCap || 85;

  // Calculate points used above base (20 for each stat)
  // Remove local calculation - use centralized data

  // Total points for display (20 base × 8 characteristics + 400 distributed = 560 total)
  const totalPointsForDisplay = (basePoints * 8) + maxStatPoints; // 560 total

  const handleStatChange = (statName: keyof typeof characterData.stats, value: number) => {
    const newStats = { ...characterData.stats, [statName]: value };

    // Update stats - derived stats will be auto-calculated by parent wizard
    // using config-based parser from CharacterCreationConfig
    updateCharacterData({
      stats: newStats
    });
  };

  // NOTE: Occupation prerequisites check is now in Step 4 (Occupation comes AFTER Stats in new flow)
  // These functions return empty/null since occupation hasn't been selected yet
  const getOccupationStatError = (statName: string): null => {
    // Occupation comes AFTER stats, so no errors shown here
    return null;
  };

  // Get occupation requirements for display (will be empty array since occupation not selected yet)
  const getOccupationRequirements = (): OccupationRequirement[] => {
    // In the new flow, occupation is selected AFTER stats (Step 4)
    // So this will always return empty array in Step 2
    // OccupationData interface no longer has prerequisites field
    return [];
  };

  const occupationRequirements = getOccupationRequirements();

  // Stats min/max values per new system
  const getMinValueForStat = () => {
    return basePoints; // All stats minimum from config
  };
  const getMaxValueForStat = () => statCreationCap; // Cap from config (creationCap)

  // Validate no stats above creation cap
  const getStatsAboveCapCount = () => {
    return Object.values(characterData.stats).filter(value => value > statCreationCap).length;
  };

  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Caratteristiche Primarie</h2>
        <p className={styles.stepDescription}>
          Distribuisci i punti caratteristica secondo il sistema Call of Cthulhu (d100).
        </p>
        <div className={styles.rulesInfo}>
          <small>• Tutte le caratteristiche partono da {basePoints} punti base</small>
          <small>• Punti da distribuire: {maxStatPoints} (sopra i {basePoints} base)</small>
          <small>• Massimo {statCreationCap} punti per caratteristica ({basePoints} base + {statCreationCap - basePoints} investiti)</small>
        </div>
      </div>

      {/* Stats Total Display - Sticky at top */}
      <div className={styles.statsSummarySticky}>
        <div className={styles.occupationBannerContent}>
          <div className={styles.occupationInfo}>
            <h4>Riepilogo Caratteristiche</h4>
            <div className={styles.pointsTracker}>
              <div className={styles.pointsRow}>
                <span className={styles.pointsLabel}>Punti Utilizzati:</span>
                <span className={styles.pointsValue}>
                  {pointsUsed || 0} / {pointsTotal || maxStatPoints}
                </span>
              </div>
              <div className={styles.pointsRow}>
                <span className={styles.pointsLabel}>Punti Rimanenti:</span>
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
            title="Prosegui con le abilità"
          >
            Continua con le Abilità →
          </button>
        </div>

        {/* Occupation Info and Requirements */}
        {characterData.occupation && (
          <div className={styles.occupationInfo}>
            <h5>Esperienze Pregresse: {characterData.occupation.name}</h5>
            {occupationRequirements.length > 0 && (
              <div className={styles.occupationRequirements}>
                <div className={styles.requirementsLabel}>Requisiti: </div>
                <div className={styles.requirementsList}>
                  {occupationRequirements.map((req, index) => {
                    const statDisplayName = {
                      strength: 'Forza',
                      dexterity: 'Destrezza',
                      intelligence: 'Intelligenza',
                      constitution: 'Costituzione',
                      charm: 'Fascino',
                      size: 'Taglia',
                      power: 'Potere',
                      education: 'Educazione'
                    }[req.statName] || req.statName;

                    return (
                      <span
                        key={req.statName}
                        className={`${styles.requirementItem} ${req.isValid ? styles.requirementMet : styles.requirementNotMet}`}
                      >
                        {statDisplayName} {req.minValue}+
                        {req.isValid ? ' ✓' : ' ⚠️'}
                        {index < occupationRequirements.length - 1 && ', '}
                      </span>
                    );
                  })}
                </div>
                {occupationRequirements.some(req => !req.isValid) && (
                  <small className={styles.requirementWarning}>
                    ⚠️ Alcuni requisiti minimi non sono soddisfatti
                  </small>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Forza (FOR)
            {getOccupationStatError('strength') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('strength')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.strength || 20}
            onChange={(e) => handleStatChange('strength', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('strength') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Potenza fisica, capacità di sollevare, spingere
          </small>
        </div>

        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Destrezza (DES)
            {getOccupationStatError('dexterity') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('dexterity')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.dexterity || 20}
            onChange={(e) => handleStatChange('dexterity', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('dexterity') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Agilità, coordinazione, velocità di reazione
          </small>
        </div>

        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Intelligenza (INT)
            {getOccupationStatError('intelligence') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('intelligence')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.intelligence || 20}
            onChange={(e) => handleStatChange('intelligence', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('intelligence') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Capacità di ragionamento, memoria, apprendimento
          </small>
        </div>

        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Costituzione (COS)
            {getOccupationStatError('constitution') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('constitution')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.constitution || 20}
            onChange={(e) => handleStatChange('constitution', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('constitution') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Salute, resistenza, capacità di sopportare fatiche
          </small>
        </div>

        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Fascino (CHA)
            {getOccupationStatError('charm') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('charm')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.charm || 20}
            onChange={(e) => handleStatChange('charm', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('charm') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Fascino, bellezza, carisma personale
          </small>
        </div>

        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Taglia (TAG)
            {getOccupationStatError('size') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('size')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.size || 20}
            onChange={(e) => handleStatChange('size', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('size') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Massa corporea, altezza e corporatura
          </small>
        </div>

        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Potere (POT)
            {getOccupationStatError('power') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('power')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.power || 20}
            onChange={(e) => handleStatChange('power', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('power') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Forza di volontà, resistenza mentale, intuito
          </small>
        </div>

        <div className={styles.statGroup}>
          <label className={styles.statLabel}>
            Educazione (EDU)
            {getOccupationStatError('education') && (
              <span
                className={styles.errorBadge}
                data-tooltip={getOccupationStatError('education')}
              >
              </span>
            )}
          </label>
          <input
            type="number"
            min={getMinValueForStat()}
            max={getMaxValueForStat()}
            value={characterData.stats.education || 20}
            onChange={(e) => handleStatChange('education', parseInt(e.target.value) || getMinValueForStat())}
            className={`${styles.input} ${getOccupationStatError('education') ? styles.inputError : ''}`}
          />
          <small className={styles.statDescription}>
            Istruzione formale, conoscenze acquisite
          </small>
        </div>
      </div>


      <div className={styles.derivedStats}>
        <h4>Statistiche Derivate</h4>
        <div className={styles.derivedStatsList}>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Punti Vita</span>
            <span className={styles.derivedValue}>{characterData.derived.hitPoints}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Sanità Mentale</span>
            <span className={styles.derivedValue}>{characterData.derived.sanityPoints}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Punti Magia</span>
            <span className={styles.derivedValue}>{characterData.derived.magicPoints}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Movimento</span>
            <span className={styles.derivedValue}>{characterData.derived.movementRate}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Fortuna</span>
            <span className={styles.derivedValue}>{characterData.derived.luckRoll}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Idea</span>
            <span className={styles.derivedValue}>{characterData.derived.ideaRoll}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Conoscenze</span>
            <span className={styles.derivedValue}>{characterData.derived.knowledge}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Bonus Danno</span>
            <span className={styles.derivedValue}>{characterData.derived.damageBonus}</span>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedLabel}>Corporatura</span>
            <span className={styles.derivedValue}>{characterData.derived.build}</span>
          </div>
        </div>
      </div>

      <div className={styles.stepNavigation}>
        <button onClick={onPrev} className={styles.prevButton}>
          ← Torna alle Esperienze Pregresse
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
          Continua con le Abilità →
        </button>
      </div>
    </div>
  );
};