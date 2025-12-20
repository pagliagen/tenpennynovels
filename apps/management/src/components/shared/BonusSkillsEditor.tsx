import React, { useState } from 'react';
import styles from '@/styles/components/shared/SkillsEditor.module.scss';

interface BonusSkill {
  skillId?: string;
  skillName: string;
  bonusValue: number;
}

interface Skill {
  _id: string;
  name: string;
}

interface BonusSkillsEditorProps {
  value: BonusSkill[];
  onChange: (skills: BonusSkill[]) => void;
  availableSkills: Skill[];
  loading?: boolean;
}

export function BonusSkillsEditor({
  value = [],
  onChange,
  availableSkills = [],
  loading = false
}: BonusSkillsEditorProps) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // Get skills that haven't been selected yet (sorted alphabetically)
  const getUnselectedSkills = () => {
    const selectedNames = value.map(s => s.skillName);
    return availableSkills
      .filter(skill => !selectedNames.includes(skill.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleAddSkill = (skill: Skill) => {
    const newSkill: BonusSkill = {
      skillId: skill._id,
      skillName: skill.name,
      bonusValue: 30
    };
    onChange([...value, newSkill]);
    setShowAddDropdown(false);
  };

  const handleRemoveSkill = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdateBonusValue = (index: number, bonusValue: number) => {
    const updated = [...value];
    updated[index] = { ...updated[index], bonusValue };
    onChange(updated);
  };

  if (loading) {
    return (
      <div className={styles.skillsEditor}>
        <label className={styles.label}>Abilità Bonus</label>
        <div className={styles.loading}>Caricamento abilità...</div>
      </div>
    );
  }

  return (
    <div className={styles.skillsEditor}>
      <label className={styles.label}>
        Abilità Bonus
        <span className={styles.hint}>Bonus abilità aggiuntivi forniti da questa occupazione</span>
      </label>

      <div className={styles.skillsList}>
        {value.map((skill, index) => (
          <div key={index} className={styles.skillItem}>
            <div className={styles.skillHeader}>
              <div className={styles.skillName}>{skill.skillName}</div>
              <button
                type="button"
                onClick={() => handleRemoveSkill(index)}
                className={styles.removeButton}
                title="Rimuovi abilità"
              >
                🗑️
              </button>
            </div>

            <div className={styles.skillControls}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>Valore Bonus:</label>
                <input
                  type="number"
                  value={skill.bonusValue}
                  onChange={(e) => handleUpdateBonusValue(index, parseInt(e.target.value) || 30)}
                  min={0}
                  max={100}
                  className={styles.numberInput}
                />
              </div>
            </div>
          </div>
        ))}

        {value.length === 0 && (
          <div className={styles.emptyState}>
            Nessuna abilità bonus aggiunta. Clicca [+] per aggiungere abilità.
          </div>
        )}
      </div>

      <div className={styles.addSkillContainer}>
        <button
          type="button"
          onClick={() => setShowAddDropdown(!showAddDropdown)}
          className={styles.addSkillButton}
        >
          + Aggiungi Abilità Bonus
        </button>
        {showAddDropdown && (
          <div className={styles.dropdown}>
            {getUnselectedSkills().length === 0 ? (
              <div className={styles.dropdownEmpty}>Tutte le abilità sono state aggiunte</div>
            ) : (
              <>
                {getUnselectedSkills().map(skill => (
                  <button
                    key={skill._id}
                    type="button"
                    onClick={() => handleAddSkill(skill)}
                    className={styles.dropdownItem}
                  >
                    {skill.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
