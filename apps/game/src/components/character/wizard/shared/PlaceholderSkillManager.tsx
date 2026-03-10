/**
 * Placeholder Skill Manager
 *
 * Manages placeholder skills (like "Lingua straniera", "Arte", etc.) that require specialization.
 * User adds multiple specializations and selects ONE as "primary" (receives required bonus to reach 40).
 *
 * @module components/character/wizard/shared/PlaceholderSkillManager
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';
import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/PlaceholderSkillManager.module.scss';

interface PlaceholderSkillManagerProps {
  /** Placeholder skill definition from API */
  placeholderSkill: any;
  /** Required minimum value (default 40) */
  requiredMinimum: number;
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
}: PlaceholderSkillManagerProps): JSX.Element {
  const { skills, dynamicSkills, addDynamicSkill, removeDynamicSkill, updateSkill } = useWizardStore();
  const [isAdding, setIsAdding] = useState(false);
  const [specialization, setSpecialization] = useState('');

  // Find all dynamic skills derived from this placeholder
  const derivedSkills = dynamicSkills.filter((ds) => ds.name === placeholderSkill.name);

  // Get placeholder type label
  const placeholderTypeLabel = getPlaceholderTypeLabel(placeholderSkill.placeholderType);

  /**
   * Handle adding new specialization
   */
  const handleAdd = () => {
    const trimmedSpec = specialization.trim();
    if (!trimmedSpec) {
      alert('Inserisci una specializzazione valida');
      return;
    }

    // Check if already exists (case-insensitive)
    if (
      derivedSkills.some((ds) => ds.specialization?.toLowerCase() === trimmedSpec.toLowerCase())
    ) {
      alert(`"${trimmedSpec}" è già stata aggiunta`);
      return;
    }

    // Generate unique skill ID
    const skillId = `${placeholderSkill.id}-${trimmedSpec.toLowerCase().replace(/\s+/g, '-')}`;

    // Add to dynamic skills
    addDynamicSkill({
      skillId,
      name: placeholderSkill.name,
      specialization: trimmedSpec,
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

    console.log(
      `[PlaceholderSkillManager] Added ${placeholderSkill.name} (${trimmedSpec}) without bonus`
    );

    // Reset form
    setSpecialization('');
    setIsAdding(false);
  };

  /**
   * Handle removing specialization
   */
  const handleRemove = (skillId: string) => {
    if (!confirm('Rimuovere questa specializzazione?')) return;

    // Get current skill to check if it was primary
    const currentSkill = skills[skillId];
    const wasPrimary = (currentSkill?.requiredBonus || 0) > 0;

    // Remove from dynamic skills
    removeDynamicSkill(skillId);

    // Remove from skills breakdown
    const { skills: currentSkills } = useWizardStore.getState();
    const { [skillId]: removed, ...remainingSkills } = currentSkills;
    useWizardStore.setState({ skills: remainingSkills });

    console.log(`[PlaceholderSkillManager] Removed ${skillId}${wasPrimary ? ' (was primary)' : ''}`);
  };

  /**
   * Handle selecting primary specialization
   */
  const handleSelectPrimary = (selectedSkillId: string) => {
    const updatedSkills = { ...skills };

    // Clear requiredBonus from all derived skills
    derivedSkills.forEach((ds) => {
      const skill = updatedSkills[ds.skillId];
      if (skill) {
        updatedSkills[ds.skillId] = {
          ...skill,
          requiredBonus: 0,
          total: skill.base + skill.manualPoints + skill.occupationBonus,
        };
      }
    });

    // Apply requiredBonus to selected skill
    const selectedSkill = updatedSkills[selectedSkillId];
    if (selectedSkill) {
      const newRequiredBonus = Math.max(0, requiredMinimum - selectedSkill.base);
      updatedSkills[selectedSkillId] = {
        ...selectedSkill,
        requiredBonus: newRequiredBonus,
        total:
          selectedSkill.base +
          newRequiredBonus +
          selectedSkill.manualPoints +
          selectedSkill.occupationBonus,
      };
    }

    // Update store
    useWizardStore.setState({ skills: updatedSkills });

    console.log(`[PlaceholderSkillManager] Set primary: ${selectedSkillId}`);
  };

  // Find which skill is currently primary (has requiredBonus > 0)
  const primarySkillId = derivedSkills.find(
    (ds) => (skills[ds.skillId]?.requiredBonus ?? 0) > 0
  )?.skillId;

  return (
    <div className={styles.placeholderSkillManager}>
      {/* Header */}
      <div className={styles.placeholderHeader}>
        <strong>⚠️ {placeholderSkill.name}</strong>
        <span className={styles.placeholderNote}>
          Aggiungi almeno una {placeholderTypeLabel} e selezionala come principale (40 punti)
        </span>
      </div>

      {/* Derived Skills List */}
      {derivedSkills.length > 0 && (
        <div className={styles.derivedSkillsList}>
          <table className={styles.derivedSkillsTable}>
            <thead>
              <tr>
                <th>Principale</th>
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
                    <td>
                      <input
                        type="radio"
                        name={`primary-${placeholderSkill.id}`}
                        checked={isPrimary}
                        onChange={() => handleSelectPrimary(ds.skillId)}
                        title="Seleziona come principale (40 punti)"
                      />
                    </td>
                    <td>
                      <strong>{ds.specialization}</strong>
                      {isPrimary && <span className={styles.primaryBadge}>★</span>}
                    </td>
                    <td>{skill.base}</td>
                    <td>{skill.requiredBonus > 0 ? `+${skill.requiredBonus}` : '-'}</td>
                    <td>{skill.manualPoints}</td>
                    <td>
                      <strong className={skill.total >= requiredMinimum ? styles.validTotal : ''}>
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

          {!primarySkillId && (
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
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder={getPlaceholderExample(placeholderSkill.placeholderType)}
            className={styles.inputText}
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
            }}
            className={styles.cancelButton}
          >
            Annulla
          </button>
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
