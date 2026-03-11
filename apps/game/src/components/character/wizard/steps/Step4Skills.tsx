/**
 * Step 4: Skills Component
 *
 * Skill allocation with budget enforcement (200 + INT/2 points).
 * Shows skill breakdown and occupation bonuses.
 *
 * @module components/character/wizard/steps/Step4Skills
 * @since 2.0.0
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWizardStore } from '@/store/wizardStore';
import { useSkills, useOccupations } from '@/hooks/useCharacterCreation';
import { useWizardToolbar } from '../WizardSlotsContext';
import { BudgetIndicator } from '../shared/BudgetIndicator';
import { PlaceholderSkillManager } from '../shared/PlaceholderSkillManager';
import styles from '@/styles/components/character/wizard/Step4Skills.module.scss';

/**
 * Step 4: Skills Component
 *
 * @returns {JSX.Element} Step 4 form
 */
export function Step4Skills(): JSX.Element {
  const { stats, skills, occupation, dynamicSkills, updateSkill, autoAssignRequiredSkills, stepErrors } = useWizardStore();
  const errors = stepErrors[4] || {};

  // Fetch skills from API
  const { data: apiSkills, isLoading, error: apiError } = useSkills();

  // Fetch occupations to get required skills data
  const { data: occupations } = useOccupations();

  // Translate category names to Italian
  const translateCategory = (cat: string): string => {
    const translations: Record<string, string> = {
      combat: 'Combattimento',
      social: 'Sociale',
      knowledge: 'Conoscenza',
      physical: 'Fisiche',
      technical: 'Tecniche',
      financial: 'Finanziarie',
      general: 'Generali',
    };
    return translations[cat.toLowerCase()] || cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  // Extract unique categories from API skills
  const categories = useMemo(() => {
    if (!apiSkills) return [];
    const uniqueCategories = [...new Set(apiSkills.map((s) => s.category))];
    return uniqueCategories.map((cat) => ({
      id: cat.toLowerCase(),
      label: translateCategory(cat),
    }));
  }, [apiSkills]);

  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || '');

  // Update activeCategory when categories load
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]!.id); // Safe: length check ensures element exists
    }
  }, [categories, activeCategory]);

  // Calculate INT bonus (200 + INT/2, physical skills DON'T get bonus)
  const intelligenceBonus = Math.floor(stats.intelligence / 2);
  const baseBudget = 200;
  const totalBudget = baseBudget + intelligenceBonus;

  // Calculate spent points (manualPoints + requiredBonus count toward budget, occupationBonus does NOT)
  const spentPoints = Object.values(skills).reduce(
    (sum, skill) => sum + skill.manualPoints + skill.requiredBonus,
    0
  );

  useWizardToolbar(() => (
    <BudgetIndicator spent={spentPoints} total={totalBudget} label="Punti Abilità" />
  ), [categories, activeCategory, spentPoints, totalBudget]);

  // Initialize skills with base values from API if not already present
  useEffect(() => {
    if (!apiSkills) return;

    apiSkills.forEach((skillDef) => {
      if (!skills[skillDef.id]) {
        updateSkill(skillDef.id, {
          base: skillDef.baseValue,
          requiredBonus: 0,
          manualPoints: 0,
          occupationBonus: 0,
          total: skillDef.baseValue,
          category: skillDef.category,
        });
      }
    });
  }, [apiSkills, skills, updateSkill]);

  /**
   * Auto-Assign Required Skills
   *
   * Triggers when:
   * - Component mounts with occupation selected
   * - Occupation changes
   * - Skill definitions load
   *
   * Ensures mandatory occupation skills automatically reach required minimum (40).
   */
  useEffect(() => {
    // Guard: require occupation, skills, and occupations data
    if (!occupation.occupationId || !apiSkills?.length || !occupations?.length) {
      return;
    }

    // Find selected occupation
    const selectedOccupation = occupations.find(
      (occ) => occ.id === occupation.occupationId
    );

    if (!selectedOccupation) {
      console.warn('[Step4Skills] Selected occupation not found in data');
      return;
    }

    // Auto-assign required skills
    autoAssignRequiredSkills(selectedOccupation, apiSkills);
  }, [
    occupation.occupationId, // Trigger when occupation changes
    apiSkills, // Trigger when skills load
    occupations, // Trigger when occupations load
    autoAssignRequiredSkills, // Include action in dependencies
  ]);

  // Filter skills by active category (including dynamic skills)
  // NOTE: useMemo must be called BEFORE any return statements (React hooks rule)
  const filteredSkills = useMemo(() => {
    if (!apiSkills) return [];

    // Get normal skills from API (exclude placeholders)
    const normalSkills = apiSkills.filter(
      (s) => !s.isPlaceholder && s.category.toLowerCase() === activeCategory
    );

    // Get dynamic skills (derived from placeholders)
    const derivedSkills = dynamicSkills
      .map((ds) => {
        // Find placeholder parent to get category and baseValue
        const placeholder = apiSkills.find((s) => s.name === ds.name);
        if (!placeholder || placeholder.category.toLowerCase() !== activeCategory) return null;

        // Create skill definition for derived skill
        return {
          id: ds.skillId,
          name: `${ds.name} (${ds.specialization})`,
          baseValue: placeholder.baseValue,
          category: placeholder.category,
          description: `${placeholder.description} - ${ds.specialization}`,
          isPlaceholder: false,
        };
      })
      .filter((s) => s !== null);

    return [...normalSkills, ...derivedSkills];
  }, [apiSkills, dynamicSkills, activeCategory]);

  /**
   * Handle manual point allocation
   */
  const handlePointChange = (skillName: string, newManualPoints: number) => {
    const skill = skills[skillName];
    if (!skill) return;

    // Enforce budget
    const currentManualPoints = skill.manualPoints;
    const pointDifference = newManualPoints - currentManualPoints;
    if (spentPoints + pointDifference > totalBudget) {
      return; // Would exceed budget
    }

    // Enforce cap (75 normally, 80 with occupation bonus)
    const maxTotal = skill.occupationBonus > 0 ? 80 : 75;
    const newTotal = skill.base + skill.requiredBonus + newManualPoints + skill.occupationBonus;
    if (newTotal > maxTotal) {
      return; // Would exceed cap
    }

    // Update skill
    updateSkill(skillName, {
      manualPoints: Math.max(0, newManualPoints),
      total: skill.base + skill.requiredBonus + Math.max(0, newManualPoints) + skill.occupationBonus,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.stepContent} data-step="skills">
        <h2 className={styles.stepTitle}>Abilità</h2>
        <div className={styles.infoBox}>⏳ Caricamento abilità...</div>
      </div>
    );
  }

  // Error state
  if (apiError || !apiSkills) {
    return (
      <div className={styles.stepContent} data-step="skills">
        <h2 className={styles.stepTitle}>Abilità</h2>
        <div className={styles.errorSummary}>
          <h4>❌ Errore nel caricamento delle abilità</h4>
          <p>{apiError?.message || 'Impossibile caricare le abilità dal server'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stepContent} data-step="skills">
      {/* Required Skills Section */}
      <div className={styles.categoryTabs}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`${styles.categoryTab} ${activeCategory === cat.id ? styles.categoryTabActive : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className={styles.skillsContent}>
        {occupation.occupationId && occupations && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Skill Obbligatorie per {occupation.currentOccupation}</h3>
            <p className={styles.helpText}>
              Queste skill sono richieste dalla tua occupazione e vengono automaticamente portate a <strong>40 punti</strong>.
            </p>

            {(() => {
              const selectedOccupation = occupations.find((occ) => occ.id === occupation.occupationId);
              if (!selectedOccupation) return null;

              // Process slot-based required skills
              const fixedSlots: { skillDef: any; slotIdx: number }[] = [];
              const choiceSlots: { options: any[]; slotIdx: number }[] = [];
              const placeholderSlots: { skillDef: any; slotIdx: number }[] = [];

              (selectedOccupation.requiredSkillSlots || []).forEach((slot: any, slotIdx: number) => {
                const options = slot.options || [];
                if (options.length === 0) return;

                if (options.length > 1) {
                  choiceSlots.push({ options, slotIdx });
                  return;
                }

                const opt = options[0];
                const skillDef = apiSkills?.find(
                  (s) => s.id === opt.skillId || s.name === opt.name
                );
                if (!skillDef) return;

                if (skillDef.isPlaceholder) {
                  placeholderSlots.push({ skillDef, slotIdx });
                } else {
                  fixedSlots.push({ skillDef, slotIdx });
                }
              });

              return (
                <>
                  {fixedSlots.length > 0 && (
                    <div className={styles.skillsTable}>
                      <div className={styles.skillsTableHeader}>
                        <div className={styles.skillsTableCell}>Abilità</div>
                        <div className={styles.skillsTableCell}>Base</div>
                        <div className={styles.skillsTableCell}>Req.</div>
                        <div className={styles.skillsTableCell}>Manuali</div>
                        <div className={styles.skillsTableCell}>Totale</div>
                      </div>
                      {fixedSlots.map(({ skillDef }) => {
                        const skill = skills[skillDef.id] || {
                          base: skillDef.baseValue,
                          requiredBonus: 0,
                          manualPoints: 0,
                          occupationBonus: 0,
                          total: skillDef.baseValue,
                        };
                        return (
                          <div key={skillDef.id} className={styles.skillsTableRow}>
                            <div className={styles.skillsTableCell}><strong>{skillDef.name}</strong></div>
                            <div className={styles.skillsTableCell}>{skill.base}</div>
                            <div className={styles.skillsTableCell}>
                              {skill.requiredBonus > 0 ? `+${skill.requiredBonus}` : '-'}
                            </div>
                            <div className={styles.skillsTableCell}>{skill.manualPoints}</div>
                            <div className={styles.skillsTableCell}>
                              <strong className={skill.total >= 40 ? styles.skillHighValue : ''}>{skill.total}</strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Choice slots: player picks one skill from N options */}
                  {choiceSlots.length > 0 && (
                    <div className={styles.skillsTable}>
                      <div className={styles.skillsTableHeader}>
                        <div className={styles.skillsTableCell}>Slot a scelta</div>
                        <div className={styles.skillsTableCell}>Opzioni</div>
                      </div>
                      {choiceSlots.map(({ options, slotIdx }) => {
                        const optionNames = options.map((o: any) => o.name).join(' / ');
                        return (
                          <div key={slotIdx} className={styles.skillsTableRow}>
                            <div className={styles.skillsTableCell}><strong>Slot {slotIdx + 1}</strong></div>
                            <div className={styles.skillsTableCell}>{optionNames}</div>
                          </div>
                        );
                      })}
                      <div className={styles.helpText} style={{padding: '8px'}}>
                        Migliora almeno una delle opzioni per ogni slot a scelta.
                      </div>
                    </div>
                  )}

                  {placeholderSlots.map(({ skillDef }) => (
                    <PlaceholderSkillManager
                      key={skillDef.id}
                      placeholderSkill={skillDef}
                      requiredMinimum={40}
                    />
                  ))}
                </>
              );
            })()}
          </div>
        )}

        {/* Bonus Skills Section */}
        {occupation.occupationId && occupations && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Skill Bonus per {occupation.currentOccupation}</h3>
            <p className={styles.helpText}>
              Queste skill ricevono un <strong>bonus extra</strong> dalla tua occupazione (non conta verso il budget).
            </p>
            <div className={styles.skillsTable}>
              <div className={styles.skillsTableHeader}>
                <div className={styles.skillsTableCell}>Abilità</div>
                <div className={styles.skillsTableCell}>Base</div>
                <div className={styles.skillsTableCell}>Bonus</div>
                <div className={styles.skillsTableCell}>Manuali</div>
                <div className={styles.skillsTableCell}>Totale</div>
              </div>
              {(() => {
                const selectedOccupation = occupations.find((occ) => occ.id === occupation.occupationId);
                if (!selectedOccupation || !selectedOccupation.bonusSkills?.length) return null;

                return selectedOccupation.bonusSkills.map((bonusSkill) => {
                  // Case-insensitive match for skill names
                  const skillDef = apiSkills?.find(
                    (s) =>
                      s.id === bonusSkill.skillId ||
                      s.name.toLowerCase() === bonusSkill.name.toLowerCase()
                  );
                  if (!skillDef) return null;

                  const skill = skills[skillDef.id] || {
                    base: skillDef.baseValue,
                    requiredBonus: 0,
                    manualPoints: 0,
                    occupationBonus: 0,
                    total: skillDef.baseValue,
                  };

                  return (
                    <div key={skillDef.id} className={styles.skillsTableRow}>
                      <div className={styles.skillsTableCell}>
                        <strong>{skillDef.name}</strong>
                      </div>
                      <div className={styles.skillsTableCell}>{skill.base}</div>
                      <div className={styles.skillsTableCell}>
                        {skill.occupationBonus > 0 ? `+${skill.occupationBonus}` : '-'}
                      </div>
                      <div className={styles.skillsTableCell}>{skill.manualPoints}</div>
                      <div className={styles.skillsTableCell}>
                        <strong className={skill.total > 75 ? styles.skillHighValue : ''}>
                          {skill.total}
                        </strong>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Skills Table */}
        <div className={styles.section}>
          <div className={styles.skillsTable}>
            <div className={styles.skillsTableHeader}>
              <div className={styles.skillsTableCell}>Abilità</div>
              <div className={styles.skillsTableCell}>Base</div>
              <div className={styles.skillsTableCell}>Req.</div>
              <div className={styles.skillsTableCell}>Bonus</div>
              <div className={styles.skillsTableCell}>Manuali</div>
              <div className={styles.skillsTableCell}>Totale</div>
              <div className={styles.skillsTableCell}>Controlli</div>
            </div>

            {filteredSkills.map((skillDef) => {
              const skill = skills[skillDef.id] || {
                base: skillDef.baseValue,
                requiredBonus: 0,
                manualPoints: 0,
                occupationBonus: 0,
                total: skillDef.baseValue,
              };

              return (
                <div key={skillDef.id} className={styles.skillsTableRow}>
                  <div className={styles.skillsTableCell}>
                    <strong>{skillDef.name}</strong>
                  </div>
                  <div className={styles.skillsTableCell}>{skill.base}</div>
                  <div className={styles.skillsTableCell}>
                    {skill.requiredBonus > 0 ? `+${skill.requiredBonus}` : '-'}
                  </div>
                  <div className={styles.skillsTableCell}>
                    {skill.occupationBonus > 0 ? `+${skill.occupationBonus}` : '-'}
                  </div>
                  <div className={styles.skillsTableCell}>
                    <input
                      type="number"
                      value={skill.manualPoints}
                      onChange={(e) => handlePointChange(skillDef.id, parseInt(e.target.value) || 0)}
                      min={0}
                      max={totalBudget}
                      className={styles.skillInput}
                    />
                  </div>
                  <div className={styles.skillsTableCell}>
                    <strong className={skill.total > 75 ? styles.skillHighValue : ''}>{skill.total}</strong>
                  </div>
                  <div className={styles.skillsTableCell}>
                    <button
                      type="button"
                      onClick={() => handlePointChange(skillDef.id, skill.manualPoints - 5)}
                      className={styles.skillButton}
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePointChange(skillDef.id, skill.manualPoints + 5)}
                      className={styles.skillButton}
                    >
                      +5
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Validation Errors */}
        {Object.keys(errors).length > 0 && (
          <div className={styles.errorSummary}>
            <h4>Errori di Validazione:</h4>
            <ul>
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
