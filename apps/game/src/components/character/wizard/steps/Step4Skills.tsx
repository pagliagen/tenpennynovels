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

import { useEffect, useMemo } from 'react';

import { useSkills, useOccupations } from '@/hooks/useCharacterCreation';
import { computeSkillPools, computeSkillPoolUsage } from '@/lib/utils/skillPools';
import { useWizardStore, resolveSkillBaseValue } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/Step4Skills.module.scss';

import { PlaceholderSkillManager } from '../shared/PlaceholderSkillManager';
import { useWizardToolbar } from '../WizardSlotsContext';
import { WarningIcon } from '../WarningIcon';
import { logger } from '@/lib/logger';


/**
 * Step 4: Skills Component
 *
 * @returns {JSX.Element} Step 4 form
 */
export function Step4Skills(): JSX.Element {
  const { stats, skills, occupation, dynamicSkills, baseClaimedByOcc, baseClaimedByHobby, updateSkill, autoAssignRequiredSkills, stepErrors, creationConfig } = useWizardStore();
  const errors = stepErrors[4] || {};

  // Fetch skills from API
  const { data: apiSkills, isLoading, error: apiError } = useSkills();

  // Fetch occupations to get required skills data
  const { data: occupations } = useOccupations();

  // Three pools: base (flexible) + occupation (EDUxN, professione) + hobby (INTxN)
  const pools = computeSkillPools(stats, creationConfig);
  const usage = computeSkillPoolUsage(skills, dynamicSkills, occupation, pools, baseClaimedByOcc, baseClaimedByHobby);
  const occupationFormula = creationConfig?.skills.occupationPointsFormula ?? 'EDUx4';
  const hobbyFormula = creationConfig?.skills.hobbyPointsFormula ?? 'INTx2';

  useWizardToolbar(() => (
    <div className={styles.pointsSummary}>
      <span className={styles.pointsLabel}>PUNTI:</span>
      <span className={`${styles.pointsValue} ${usage.spentOcc > pools.occPool ? styles.pointsExceeded : ''}`}>
        Professione ({occupationFormula}) {usage.spentOcc}/{pools.occPool}
      </span>
      <span className={`${styles.pointsValue} ${usage.spentHobby > pools.hobbyPool ? styles.pointsExceeded : ''}`}>
        Hobby ({hobbyFormula}) {usage.spentHobby}/{pools.hobbyPool}
      </span>
      <span className={`${styles.pointsValue} ${usage.baseUsed > pools.basePool ? styles.pointsExceeded : styles.pointsValid}`}>
        Base liberi {usage.baseUsed}/{pools.basePool}
      </span>
      <WarningIcon message={stepErrors[4]?.skillsBudget} />
    </div>
  ), [usage.spentOcc, usage.spentHobby, usage.baseUsed, pools.occPool, pools.hobbyPool, pools.basePool, occupationFormula, hobbyFormula, stepErrors]);

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
   * Ensures mandatory occupation skills automatically reach required minimum (config-driven, default 30).
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
      logger.warn('[Step4Skills] Selected occupation not found in data');
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

  // Get all skills (including dynamic skills) without category filtering
  // NOTE: useMemo must be called BEFORE any return statements (React hooks rule)
  const allSkills = useMemo(() => {
    if (!apiSkills) return [];

    // Get normal skills from API (exclude placeholders)
    const normalSkills = apiSkills.filter((s) => !s.isPlaceholder);

    // Get dynamic skills (derived from placeholders)
    const derivedSkills = dynamicSkills
      .map((ds) => {
        // Find placeholder parent to get category and baseValue
        const placeholder = apiSkills.find((s) => s.name === ds.name);
        if (!placeholder) return null;

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
  }, [apiSkills, dynamicSkills, stats]);

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

    // Reverse calculation: manualPoints = total - base - requiredBonus - occupationBonus.
    // Nessun blocco qui (minimo/budget/cap): il giocatore deve poter digitare
    // liberamente il totale desiderato. La validazione avviene solo allo step
    // change (validateStep4, wizardValidation.ts).
    const calculatedManual = newTotal - base - requiredBonus - occupationBonus;

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

  // Placeholder skills that need specialization (e.g. Lingua Straniera, Arte, Scienza)
  const placeholderSkills = apiSkills.filter((s) => s.isPlaceholder);

  // Required minimum from global config (occupation.requiredSkillMinimum), default 30
  const requiredSkillMinimum = creationConfig?.occupation?.requiredSkillMinimum ?? 30;

  return (
    <div className={styles.stepContent} data-step="skills">
      <div className={styles.skillsContent}>
        {usage.totalSpent > pools.totalPool && (
          <div className={styles.warningBox}>
            ⚠️ Hai speso più punti di quanti ne siano ora disponibili (probabilmente EDU o INT sono cambiati tornando allo Step 3). Riduci qualche abilità per rientrare nel budget.
          </div>
        )}

        {/* Placeholder Skills (specializations like Lingua Straniera) */}
        {placeholderSkills.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Abilità con Specializzazione</h3>
            {placeholderSkills.map((placeholderSkill) => (
              <PlaceholderSkillManager
                key={placeholderSkill.id}
                placeholderSkill={placeholderSkill}
                requiredMinimum={requiredSkillMinimum}
                error={errors[`placeholder_${placeholderSkill.name}`]}
              />
            ))}
          </div>
        )}

        {/* All Skills - 3 Column Layout */}
        <div className={styles.section}>
          <div className={styles.skillsGrid}>
            {allSkills.map((skillDef) => {
              const rbFiltered = resolveSkillBaseValue(skillDef.baseFormula, skillDef.baseValue, stats);
              const skill = skills[skillDef.id] || {
                base: rbFiltered,
                requiredBonus: 0,
                manualPoints: 0,
                occupationBonus: 0,
                total: rbFiltered,
              };

              const maxTotal = skill.occupationBonus > 0 ? 80 : 75;
              const minTotal = skill.base + skill.requiredBonus + skill.occupationBonus;
              const isAtCap = skill.total >= maxTotal;
              const skillError = errors[`skill_${skillDef.id}`] || errors[`skill_${skillDef.id}_min`];

              return (
                <div key={skillDef.id} className={styles.skillCard}>
                  <div className={styles.skillCardHeader}>
                    <strong className={styles.skillName}>{skillDef.name}</strong>
                    <WarningIcon message={skillError} />
                  </div>

                  <div className={styles.skillCardBody}>
                    <input
                      type="number"
                      value={skill.total}
                      onChange={(e) => handleTotalChange(skillDef.id, parseInt(e.target.value) || 0)}
                      min={minTotal}
                      max={maxTotal}
                      className={styles.totalInput}
                      aria-label={`Punti totali per ${skillDef.name}`}
                    />
                    {isAtCap && (
                      <span className={styles.capWarning} title={`Limite massimo (${maxTotal}) raggiunto`}>
                        ⚠️ Max
                      </span>
                    )}
                  </div>

                    <div className={styles.skillCardFooter}>
                    <div className={styles.badgeRow}>
                        <span className={styles.badgeBase}>Base: {skill.base}</span>
                    </div>
                      {skill.occupationBonus > 0 && (
                        <span className={styles.badgeBonus} title="Non conta verso il budget">
                          +{skill.occupationBonus}
                        </span>
                      )}
                      {occupation.occupationSkillIds?.includes(skillDef.id) && (
                        <span className={styles.badgeOccupation} title="Sul listino della professione: spende dal pool EDUxN">
                          Professione
                        </span>
                      )}
                      {skill.requiredBonus > 0 && (
                        <span className={styles.badgeRequired} title={`Abilità obbligatoria, portata a ${requiredSkillMinimum}`}>
                          Richiesta
                        </span>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
