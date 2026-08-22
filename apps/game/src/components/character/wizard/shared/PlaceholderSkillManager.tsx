/**
 * Placeholder Skill Manager
 *
 * Manages placeholder skills (like "Lingua straniera", "Arte", etc.) that require specialization.
 * User adds multiple specializations and selects ONE as "primary" (receives required bonus to reach requiredMinimum).
 *
 * @module components/character/wizard/shared/PlaceholderSkillManager
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';

import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/PlaceholderSkillManager.module.scss';
import { logger } from '@/lib/logger';
import { WarningIcon } from '../WarningIcon';

interface PlaceholderSkillManagerProps {
  /** Placeholder skill definition from API */
  placeholderSkill: any;
  /** Required minimum value (config-driven, default 30) */
  requiredMinimum: number;
  /** Step-level validation error for this placeholder (validateStep4), if any */
  error?: string;
}

/**
 * Placeholder Skill Manager Component
 *
 * Shows interface for adding/removing specializations.
 * User selects ONE specialization as "primary" (receives required bonus).
 *
 * @param {PlaceholderSkillManagerProps} props - Component props
 * @returns {JSX.Element} Placeholder skill manager
 */
export function PlaceholderSkillManager({
  placeholderSkill,
  requiredMinimum,
  error,
}: PlaceholderSkillManagerProps): JSX.Element {
  const { skills, dynamicSkills, occupation, addDynamicSkill, removeDynamicSkill, setPrimaryDynamicSkill, updateSkill } =
    useWizardStore();
  const [isAdding, setIsAdding] = useState(false);
  const [specialization, setSpecialization] = useState('');
  const [inputError, setInputError] = useState('');

  // Find all dynamic skills derived from this placeholder
  const derivedSkills = dynamicSkills.filter((ds) => ds.name === placeholderSkill.name);

  // Il concetto di "principale" esiste SOLO se il placeholder è sul listino
  // della professione: lì occupa uno slot obbligatorio, quindi una
  // specializzazione va eletta e portata al minimo richiesto, e solo quella
  // spende dal pool Professione. Fuori dal listino non c'è nessuno slot da
  // occupare: sono tutte specializzazioni libere, senza minimo, a carico del
  // pool hobby — mostrare il radio "Principale" non avrebbe senso.
  const isOccupationPlaceholder = (occupation.requiredPlaceholderSkills || []).includes(
    placeholderSkill.name
  );

  // Get placeholder type label
  const placeholderTypeLabel = getPlaceholderTypeLabel(placeholderSkill.placeholderType);

  /**
   * Handle adding new specialization
   */
  const handleAdd = () => {
    setInputError('');
    const trimmedSpec = specialization.trim();
    if (!trimmedSpec) {
      setInputError('Inserisci una specializzazione valida');
      return;
    }

    if (
      derivedSkills.some((ds) => ds.specialization?.toLowerCase() === trimmedSpec.toLowerCase())
    ) {
      setInputError(`"${trimmedSpec}" è già stata aggiunta`);
      return;
    }

    // Generate unique skill ID
    const skillId = `${placeholderSkill.id}-${trimmedSpec.toLowerCase().replace(/\s+/g, '-')}`;

    // Add to dynamic skills (mai principale d'ufficio: la sceglie il giocatore
    // col radio, ed è quella che spende dal pool Professione)
    addDynamicSkill({
      skillId,
      name: placeholderSkill.name,
      specialization: trimmedSpec,
      isPrimary: false,
    });

    // Initialize skill breakdown (NO required bonus yet - user must select primary)
    updateSkill(skillId, {
      base: placeholderSkill.baseValue,
      requiredBonus: 0,
      manualPoints: 0,
      occupationBonus: 0,
      total: placeholderSkill.baseValue,
      category: placeholderSkill.category,
    });

    logger.info(`[PlaceholderSkillManager] Added ${placeholderSkill.name} (${trimmedSpec}) without bonus`);

    // Reset form
    setSpecialization('');
    setIsAdding(false);
  };

  /**
   * Handle removing specialization
   */
  const handleRemove = (skillId: string) => {
    if (!confirm('Rimuovere questa specializzazione?')) return;

    const wasPrimary = derivedSkills.find((ds) => ds.skillId === skillId)?.isPrimary === true;

    // removeDynamicSkill ripulisce anche il breakdown in `skills`
    removeDynamicSkill(skillId);

    logger.info(`[PlaceholderSkillManager] Removed ${skillId}${wasPrimary ? ' (was primary)' : ''}`);
  };

  /**
   * Handle selecting primary specialization
   */
  const handleSelectPrimary = (selectedSkillId: string) => {
    setPrimaryDynamicSkill(selectedSkillId);
    logger.info(`[PlaceholderSkillManager] Set primary: ${selectedSkillId}`);
  };

  // La principale è marcata esplicitamente: dedurla da requiredBonus > 0 non
  // funziona se la base del placeholder è già >= requiredMinimum (bonus = 0).
  const primarySkillId = isOccupationPlaceholder
    ? derivedSkills.find((ds) => ds.isPrimary)?.skillId
    : undefined;

  return (
    <div className={styles.placeholderSkillManager}>
      {/* Header */}
      <div className={styles.placeholderHeader}>
        <strong>{isOccupationPlaceholder ? '⚠️ ' : ''}{placeholderSkill.name}</strong>
        <WarningIcon message={error} />
        <span className={styles.placeholderNote}>
          {isOccupationPlaceholder
            ? `Sul listino della professione: aggiungi almeno una ${placeholderTypeLabel} e selezionala come principale (${requiredMinimum} punti)`
            : `Aggiungi una ${placeholderTypeLabel} se vuoi: nessun minimo richiesto, spende dal pool hobby`}
        </span>
      </div>

      {/* Derived Skills List */}
      {derivedSkills.length > 0 && (
        <div className={styles.derivedSkillsList}>
          <table className={styles.derivedSkillsTable}>
            <thead>
              <tr>
                {isOccupationPlaceholder && <th>Principale</th>}
                <th>Specializzazione</th>
                <th>Base</th>
                <th>Req.</th>
                <th>Man.</th>
                <th>Totale</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {derivedSkills.map((ds) => {
                const skill = skills[ds.skillId] || {
                  base: placeholderSkill.baseValue,
                  requiredBonus: 0,
                  manualPoints: 0,
                  occupationBonus: 0,
                  total: placeholderSkill.baseValue,
                };

                const isPrimary = ds.skillId === primarySkillId;

                return (
                  <tr key={ds.skillId} className={isPrimary ? styles.primaryRow : ''}>
                    {isOccupationPlaceholder && (
                      <td>
                        <input
                          type="radio"
                          name={`primary-${placeholderSkill.id}`}
                          checked={isPrimary}
                          onChange={() => handleSelectPrimary(ds.skillId)}
                          title={`Seleziona come principale (${requiredMinimum} punti)`}
                        />
                      </td>
                    )}
                    <td>
                      <strong>{ds.specialization}</strong>
                      {isPrimary && isOccupationPlaceholder && <span className={styles.primaryBadge}>★</span>}
                    </td>
                    <td>{skill.base}</td>
                    <td>{skill.requiredBonus > 0 ? `+${skill.requiredBonus}` : '-'}</td>
                    <td>{skill.manualPoints}</td>
                    <td>
                      <strong className={!isOccupationPlaceholder || skill.total >= requiredMinimum ? styles.validTotal : ''}>
                        {skill.total}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleRemove(ds.skillId)}
                        className={styles.deleteButton}
                        title="Rimuovi"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {isOccupationPlaceholder && !primarySkillId && (
            <div className={styles.warningMessage}>
              ⚠️ Seleziona una {placeholderTypeLabel} come principale per soddisfare il requisito
            </div>
          )}
        </div>
      )}

      {/* Add Form */}
      {!isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className={styles.addButton}
        >
          + Aggiungi {placeholderTypeLabel}
        </button>
      )}

      {isAdding && (
        <div className={styles.addForm}>
          <div className={styles.addFormRow}>
            <input
              type="text"
              value={specialization}
              onChange={(e) => { setSpecialization(e.target.value); setInputError(''); }}
              placeholder={getPlaceholderExample(placeholderSkill.placeholderType)}
              className={`${styles.inputText} ${inputError ? styles.inputTextError : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <button type="button" onClick={handleAdd} className={styles.confirmButton}>
              Aggiungi
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setSpecialization('');
                setInputError('');
              }}
              className={styles.cancelButton}
            >
              Annulla
            </button>
          </div>
          {inputError && (
            <div className={styles.inputErrorMessage}>{inputError}</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Get placeholder type label (singular)
 */
function getPlaceholderTypeLabel(placeholderType?: string): string {
  switch (placeholderType) {
    case 'lingua':
      return 'lingua';
    case 'arte':
      return 'arte';
    case 'scienza':
      return 'scienza';
    default:
      return 'specializzazione';
  }
}

/**
 * Get placeholder example for input
 */
function getPlaceholderExample(placeholderType?: string): string {
  switch (placeholderType) {
    case 'lingua':
      return 'Es: Francese, Tedesco, Italiano...';
    case 'arte':
      return 'Es: Pittura, Scultura...';
    case 'scienza':
      return 'Es: Chimica, Fisica...';
    default:
      return 'Inserisci specializzazione';
  }
}
