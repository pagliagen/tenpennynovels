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
import { useWizardStore, resolveSkillBaseValue } from '@/store/wizardStore';
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
  const { stats, skills, occupation, dynamicSkills, updateSkill, autoAssignRequiredSkills, stepErrors, creationConfig } = useWizardStore();
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

  // Get total skill points from config (flat value, no INT bonus)
  const totalBudget = creationConfig?.skills.totalPoints ?? 250;

  // Calculate spent points (manualPoints + requiredBonus count toward budget, occupationBonus does NOT)
  const spentPoints = Object.values(skills).reduce(
    (sum, skill) => sum + skill.manualPoints + skill.requiredBonus,
    0
  );

  useWizardToolbar(() => (
    <BudgetIndicator spent={spentPoints} total={totalBudget} label="Punti Abilità" />
  ), [categories, activeCategory, spentPoints, totalBudget]);

  // Initialize skills with base values from API (resolve formulas with current stats)
  useEffect(() => {
    if (!apiSkills) return;

    apiSkills.forEach((skillDef) => {
      const resolvedBase = resolveSkillBaseValue(skillDef.baseFormula, skillDef.baseValue, stats);
      const existingSkill = skills[skillDef.id];

      if (!existingSkill) {
        updateSkill(skillDef.id, {
          base: resolvedBase,
          requiredBonus: 0,
          manualPoints: 0,
          occupationBonus: 0,
          total: resolvedBase,
          category: skillDef.category,
        });
      } else if (existingSkill.base !== resolvedBase) {
        updateSkill(skillDef.id, {
          ...existingSkill,
          base: resolvedBase,
          total: resolvedBase + existingSkill.requiredBonus + existingSkill.manualPoints + existingSkill.occupationBonus,
        });
      }
    });
  }, [apiSkills, skills, updateSkill, stats]);

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
    occupation.occupationId,
    apiSkills,
    occupations,
    autoAssignRequiredSkills,
    stats,
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

        return {
          id: ds.skillId,
          name: `${ds.name} (${ds.specialization})`,
          baseValue: resolveSkillBaseValue(placeholder.baseFormula, placeholder.baseValue, stats),
          baseFormula: placeholder.baseFormula,
          category: placeholder.category,
          description: `${placeholder.description} - ${ds.specialization}`,
          isPlaceholder: false,
        };
      })
      .filter((s) => s !== null);

    return [...normalSkills, ...derivedSkills];
  }, [apiSkills, dynamicSkills, activeCategory]);

  /**
   * Calculate budget cost for displaying below input
   * Cost = manualPoints + requiredBonus (both count toward budget)
   */
  const calculateBudgetCost = (skill: { manualPoints: number; requiredBonus: number }): number => {
    return skill.manualPoints + skill.requiredBonus;
  };

  /**
   * Handle total value change (user inputs desired total)
   * Reverse-calculates manualPoints from total
   */
  const handleTotalChange = (skillId: string, newTotal: number) => {
    const skill = skills[skillId];
    if (!skill) return;

    const base = skill.base;
    const occupationBonus = skill.occupationBonus;
    const requiredBonus = skill.requiredBonus;

    // Reverse calculation: manualPoints = total - base - requiredBonus - occupationBonus
    const calculatedManual = newTotal - base - requiredBonus - occupationBonus;

    // Validation 1: Can't go below minimum (base + bonuses)
    if (calculatedManual < 0) {
      return; // Silently ignore
    }

    // Validation 2: Budget check
    const currentManualPoints = skill.manualPoints;
    const pointDifference = calculatedManual - currentManualPoints;
    if (spentPoints + pointDifference > totalBudget) {
      return; // Would exceed budget
    }

    // Validation 3: Cap enforcement
    const maxTotal = skill.occupationBonus > 0 ? 80 : 75;
    if (newTotal > maxTotal) {
      return; // Would exceed cap
    }

    // Update skill (updateSkill will recalculate total)
    updateSkill(skillId, {
      manualPoints: calculatedManual,
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
                        <div className={styles.skillsTableCell}>Punti Totali</div>
                        <div className={styles.skillsTableCell}></div>
                      </div>
                      {fixedSlots.map(({ skillDef }) => {
                        const rb = resolveSkillBaseValue(skillDef.baseFormula, skillDef.baseValue, stats);
                        const skill = skills[skillDef.id] || {
                          base: rb,
                          requiredBonus: 0,
                          manualPoints: 0,
                          occupationBonus: 0,
                          total: rb,
                        };
                        const budgetCost = calculateBudgetCost(skill);
                        const maxTotal = skill.occupationBonus > 0 ? 80 : 75;
                        const minTotal = skill.base + skill.requiredBonus + skill.occupationBonus;
                        const isAtCap = skill.total >= maxTotal;

                        return (
                          <div key={skillDef.id} className={styles.skillsTableRow}>
                            <div className={styles.skillNameCell}>
                              <strong>{skillDef.name}</strong>
                              <div className={styles.badgeRow}>
                                {skill.base > 0 && (
                                  <span className={styles.badgeBase}>Base: {skill.base}</span>
                                )}
                                {skill.occupationBonus > 0 && (
                                  <span className={styles.badgeBonus} title="Non conta verso il budget">
                                    +{skill.occupationBonus} Bonus Mestiere
                                  </span>
                                )}
                                {skill.requiredBonus > 0 && (
                                  <span className={styles.badgeRequired} title="Abilità obbligatoria, portata a 40">
                                    Richiesta: 40
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className={styles.inputCell}>
                              <input
                                type="number"
                                value={skill.total}
                                onChange={(e) => handleTotalChange(skillDef.id, parseInt(e.target.value) || 0)}
                                min={minTotal}
                                max={maxTotal}
                                className={styles.totalInput}
                                aria-label={`Punti totali per ${skillDef.name}`}
                                aria-describedby={`budget-cost-req-${skillDef.id}`}
                              />
                              <span
                                id={`budget-cost-req-${skillDef.id}`}
                                className={styles.budgetCostLabel}
                                data-cost={budgetCost}
                                data-warning={spentPoints > totalBudget}
                              >
                                Costo budget: {budgetCost} {budgetCost === 1 ? 'punto' : 'punti'}
                              </span>
                            </div>
                            <div className={styles.capCell}>
                              {isAtCap ? (
                                <span className={styles.capWarning} title={`Limite massimo (${maxTotal}) raggiunto`}>
                                  ⚠️
                                </span>
                              ) : (
                                <span className={styles.capOk} title="Entro il limite">
                                  ✓
                                </span>
                              )}
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
                <div className={styles.skillsTableCell}>Punti Totali</div>
                <div className={styles.skillsTableCell}></div>
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

                  const rbBonus = resolveSkillBaseValue(skillDef.baseFormula, skillDef.baseValue, stats);
                  const skill = skills[skillDef.id] || {
                    base: rbBonus,
                    requiredBonus: 0,
                    manualPoints: 0,
                    occupationBonus: 0,
                    total: rbBonus,
                  };

                  const budgetCost = calculateBudgetCost(skill);
                  const maxTotal = skill.occupationBonus > 0 ? 80 : 75;
                  const minTotal = skill.base + skill.requiredBonus + skill.occupationBonus;
                  const isAtCap = skill.total >= maxTotal;

                  return (
                    <div key={skillDef.id} className={styles.skillsTableRow}>
                      <div className={styles.skillNameCell}>
                        <strong>{skillDef.name}</strong>
                        <div className={styles.badgeRow}>
                          {skill.base > 0 && (
                            <span className={styles.badgeBase}>Base: {skill.base}</span>
                          )}
                          {skill.occupationBonus > 0 && (
                            <span className={styles.badgeBonus} title="Non conta verso il budget">
                              +{skill.occupationBonus} Bonus Mestiere
                            </span>
                          )}
                          {skill.requiredBonus > 0 && (
                            <span className={styles.badgeRequired} title="Abilità obbligatoria, portata a 40">
                              Richiesta: 40
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.inputCell}>
                        <input
                          type="number"
                          value={skill.total}
                          onChange={(e) => handleTotalChange(skillDef.id, parseInt(e.target.value) || 0)}
                          min={minTotal}
                          max={maxTotal}
                          className={styles.totalInput}
                          aria-label={`Punti totali per ${skillDef.name}`}
                          aria-describedby={`budget-cost-bonus-${skillDef.id}`}
                        />
                        <span
                          id={`budget-cost-bonus-${skillDef.id}`}
                          className={styles.budgetCostLabel}
                          data-cost={budgetCost}
                          data-warning={spentPoints > totalBudget}
                        >
                          Costo budget: {budgetCost} {budgetCost === 1 ? 'punto' : 'punti'}
                        </span>
                      </div>
                      <div className={styles.capCell}>
                        {isAtCap ? (
                          <span className={styles.capWarning} title={`Limite massimo (${maxTotal}) raggiunto`}>
                            ⚠️
                          </span>
                        ) : (
                          <span className={styles.capOk} title="Entro il limite">
                            ✓
                          </span>
                        )}
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
              <div className={styles.skillsTableCell}>Punti Totali</div>
              <div className={styles.skillsTableCell}></div>
            </div>

            {filteredSkills.map((skillDef) => {
              const rbFiltered = resolveSkillBaseValue(skillDef.baseFormula, skillDef.baseValue, stats);
              const skill = skills[skillDef.id] || {
                base: rbFiltered,
                requiredBonus: 0,
                manualPoints: 0,
                occupationBonus: 0,
                total: rbFiltered,
              };

              const budgetCost = calculateBudgetCost(skill);
              const maxTotal = skill.occupationBonus > 0 ? 80 : 75;
              const minTotal = skill.base + skill.requiredBonus + skill.occupationBonus;
              const isAtCap = skill.total >= maxTotal;

              return (
                <div key={skillDef.id} className={styles.skillsTableRow}>
                  {/* Column 1: Name + Badges */}
                  <div className={styles.skillNameCell}>
                    <strong>{skillDef.name}</strong>
                    <div className={styles.badgeRow}>
                      {skill.base > 0 && (
                        <span className={styles.badgeBase}>Base: {skill.base}</span>
                      )}
                      {skill.occupationBonus > 0 && (
                        <span className={styles.badgeBonus} title="Non conta verso il budget">
                          +{skill.occupationBonus} Bonus Mestiere
                        </span>
                      )}
                      {skill.requiredBonus > 0 && (
                        <span className={styles.badgeRequired} title="Abilità obbligatoria, portata a 40">
                          Richiesta: 40
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Input (total) + Budget Cost */}
                  <div className={styles.inputCell}>
                    <input
                      type="number"
                      value={skill.total}
                      onChange={(e) => handleTotalChange(skillDef.id, parseInt(e.target.value) || 0)}
                      min={minTotal}
                      max={maxTotal}
                      className={styles.totalInput}
                      aria-label={`Punti totali per ${skillDef.name}`}
                      aria-describedby={`budget-cost-${skillDef.id}`}
                    />
                    <span
                      id={`budget-cost-${skillDef.id}`}
                      className={styles.budgetCostLabel}
                      data-cost={budgetCost}
                      data-warning={spentPoints > totalBudget}
                    >
                      Costo budget: {budgetCost} {budgetCost === 1 ? 'punto' : 'punti'}
                    </span>
                  </div>

                  {/* Column 3: Cap Indicator */}
                  <div className={styles.capCell}>
                    {isAtCap ? (
                      <span className={styles.capWarning} title={`Limite massimo (${maxTotal}) raggiunto`}>
                        ⚠️
                      </span>
                    ) : (
                      <span className={styles.capOk} title="Entro il limite">
                        ✓
                      </span>
                    )}
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
