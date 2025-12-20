import React, { useState, useEffect } from 'react';
import styles from '@/styles/components/shared/SkillsEditor.module.scss';

interface AlternativeSkill {
  skillId?: string;
  skillName: string;
}

interface RequiredSkill {
  skillId?: string;
  skillName: string;
  baseValue: number;
  isFixed?: boolean;
  alternatives?: AlternativeSkill[];
}

interface Skill {
  _id: string;
  name: string;
}

interface RequiredSkillsEditorProps {
  value: RequiredSkill[];
  onChange: (skills: RequiredSkill[]) => void;
  availableSkills: Skill[];
  loading?: boolean;
}

export function RequiredSkillsEditor({
  value = [],
  onChange,
  availableSkills = [],
  loading = false
}: RequiredSkillsEditorProps) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showAltDropdown, setShowAltDropdown] = useState<number | null>(null);

  // Get skills that haven't been selected yet (sorted alphabetically)
  const getUnselectedSkills = (excludeSkillNames: string[] = []) => {
    const selectedNames = value.map(s => s.skillName);
    return availableSkills
      .filter(skill => !selectedNames.includes(skill.name) && !excludeSkillNames.includes(skill.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleAddSkill = (skill: Skill) => {
    const newSkill: RequiredSkill = {
      skillId: skill._id,
      skillName: skill.name,
      baseValue: 40,
      isFixed: true, // Default: mandatory (no alternatives)
      alternatives: []
    };
    onChange([...value, newSkill]);
    setShowAddDropdown(false);
  };

  const handleRemoveSkill = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdateSkill = (index: number, updates: Partial<RequiredSkill>) => {
    const updated = [...value];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleAddAlternative = (skillIndex: number, skill: Skill) => {
    const updated = [...value];
    const currentAlternatives = updated[skillIndex].alternatives || [];
    updated[skillIndex].alternatives = [
      ...currentAlternatives,
      { skillId: skill._id, skillName: skill.name }
    ];
    // Automatically set isFixed = false when alternatives exist
    updated[skillIndex].isFixed = false;
    onChange(updated);
    setShowAltDropdown(null);
  };

  const handleRemoveAlternative = (skillIndex: number, altIndex: number) => {
    const updated = [...value];
    updated[skillIndex].alternatives = updated[skillIndex].alternatives?.filter((_, i) => i !== altIndex);
    // Automatically set isFixed = true when no alternatives remain
    if (!updated[skillIndex].alternatives || updated[skillIndex].alternatives.length === 0) {
      updated[skillIndex].isFixed = true;
    }
    onChange(updated);
  };

  if (loading) {
    return (
      <div className={styles.skillsEditor}>
        <label className={styles.label}>Abilità Richieste</label>
        <div className={styles.loading}>Caricamento abilità...</div>
      </div>
    );
  }

  return (
    <div className={styles.skillsEditor}>
      <label className={styles.label}>
        Abilità Richieste
        <span className={styles.hint}>Abilità base necessarie per questa occupazione</span>
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
                <label className={styles.controlLabel}>Valore Base:</label>
                <input
                  type="number"
                  value={skill.baseValue}
                  onChange={(e) => handleUpdateSkill(index, { baseValue: parseInt(e.target.value) || 40 })}
                  min={0}
                  max={100}
                  className={styles.numberInput}
                />
              </div>

              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>
                  {skill.isFixed ? '🔒 Obbligatoria' : '🔓 Opzionale (scegli una)'}
                </span>
              </div>
            </div>

            <div className={styles.alternativesSection}>
                <div className={styles.alternativesHeader}>
                  <span className={styles.alternativesLabel}>Alternative (scegli una tra):</span>
                  <div className={styles.addAlternativeContainer}>
                    <button
                      type="button"
                      onClick={() => setShowAltDropdown(showAltDropdown === index ? null : index)}
                      className={styles.addAlternativeButton}
                    >
                      + Aggiungi Alternativa
                    </button>
                    {showAltDropdown === index && (
                      <div className={styles.dropdown}>
                        {getUnselectedSkills(skill.alternatives?.map(a => a.skillName) || []).length === 0 ? (
                          <div className={styles.dropdownEmpty}>Nessuna abilità disponibile</div>
                        ) : (
                          <>
                            {getUnselectedSkills(skill.alternatives?.map(a => a.skillName) || []).map(s => (
                              <button
                                key={s._id}
                                type="button"
                                onClick={() => handleAddAlternative(index, s)}
                                className={styles.dropdownItem}
                              >
                                {s.name}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {skill.alternatives && skill.alternatives.length > 0 && (
                  <div className={styles.alternativesList}>
                    {skill.alternatives.map((alt, altIndex) => (
                      <div key={altIndex} className={styles.alternativeItem}>
                        <span>{alt.skillName}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAlternative(index, altIndex)}
                          className={styles.removeAltButton}
                          title="Rimuovi alternativa"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
        ))}

        {value.length === 0 && (
          <div className={styles.emptyState}>
            Nessuna abilità richiesta aggiunta. Clicca [+] per aggiungere abilità.
          </div>
        )}
      </div>

      <div className={styles.addSkillContainer}>
        <button
          type="button"
          onClick={() => setShowAddDropdown(!showAddDropdown)}
          className={styles.addSkillButton}
        >
          + Aggiungi Abilità Richiesta
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
