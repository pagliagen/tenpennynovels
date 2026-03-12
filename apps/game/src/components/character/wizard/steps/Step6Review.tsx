/**
 * Step 6: Review Component
 *
 * Final review of all character data before submission.
 * Shows summary cards for each section and handles final submission.
 *
 * @module components/character/wizard/steps/Step6Review
 * @since 2.0.0
 */

'use client';

import { useWizardStore } from '@/store/wizardStore';
import { useSkills } from '@/hooks/useCharacterCreation';
import { DataSummaryCard } from '../shared/DataSummaryCard';
import { useWizardToolbar } from '../WizardSlotsContext';
import styles from '@/styles/components/character/wizard/Step6Review.module.scss';

/**
 * Step 6: Review Component
 *
 * @returns {JSX.Element} Step 6 review interface
 */
export function Step6Review(): JSX.Element {
  const { basicInfo, occupation, stats, derivedStats, skills, dynamicSkills, validateAll, stepErrors } =
    useWizardStore();

  // Fetch skill definitions for ID → name mapping
  const { data: apiSkills } = useSkills();

  // Run validation to show any remaining errors
  const validation = validateAll();
  const allErrors = stepErrors;

  // Calculate skill totals
  const totalSkillPoints = Object.values(skills).reduce((sum, skill) => sum + skill.manualPoints, 0);
  // Type assertion safe: WizardStats declared properties are all number
  const totalStatPoints = (Object.values(stats) as number[]).reduce((sum, val) => sum + val, 0);

  // Helper: Get skill name from ID
  const getSkillName = (skillId: string): string => {
    // Check dynamic skills first (specializations like "Lingua straniera: Francese")
    const dynamicSkill = dynamicSkills.find((ds) => ds.skillId === skillId);
    if (dynamicSkill) {
      // If has specialization, show "Base Name: Specialization"
      if (dynamicSkill.specialization) {
        return `${dynamicSkill.name.trim()} (${dynamicSkill.specialization.trim()})`;
      }
      return dynamicSkill.name.trim();
    }

    // Check API skills
    const apiSkill = apiSkills?.find((s) => s.id === skillId);
    if (apiSkill) return apiSkill.name;

    // Fallback to ID if not found
    return skillId;
  };
 
  const errorCount = Object.values(validation.errors).length;

  useWizardToolbar(() => (
    <>
      <span className={styles.toolbarTitle}>RIEPILOGO FINALE</span>
      <span className={validation.valid ? styles.toolbarValid : styles.toolbarErrors}>
        {validation.valid ? '✓ Pronto per l\'invio' : `✗ ${errorCount} errori da correggere`}
      </span>
    </>
  ), [validation.valid, errorCount]);

  return (
    <div className={styles.stepContent} data-step="riepilogo">
      {/* Validation Status */}
      {!validation.valid && (
        <div className={styles.errorSummary}>
          <h4>⚠️ Errori di Validazione</h4>
          <p>Correggi i seguenti errori prima di procedere:</p>
          <ul>
            {Object.entries(validation.errors).map(([field, error]) => (
              <li key={field}>
                <strong>{field}:</strong> {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation.valid && (
        <div className={styles.successBox}>✓ Tutti i dati sono validi. Pronto per l&apos;invio!</div>
      )}

      {/* Basic Info Summary */}
      <DataSummaryCard title="Informazioni Base">
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Nome:</span>
          <span className={styles.summaryValue}>
            {basicInfo.firstName} {basicInfo.lastName}
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Età:</span>
          <span className={styles.summaryValue}>
            {basicInfo.age} anni
            {basicInfo.apparentAge && basicInfo.apparentAge !== basicInfo.age && ` (apparente: ${basicInfo.apparentAge})`}
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Genere:</span>
          <span className={styles.summaryValue}>{basicInfo.gender || 'Non specificato'}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Luogo di Nascita:</span>
          <span className={styles.summaryValue}>{basicInfo.birthplace || 'Non specificato'}</span>
        </div>
        {basicInfo.maritalStatus && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Stato Civile:</span>
            <span className={styles.summaryValue}>{basicInfo.maritalStatus}</span>
          </div>
        )}
        {basicInfo.educationTitle && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Istruzione:</span>
            <span className={styles.summaryValue}>{basicInfo.educationTitle}</span>
          </div>
        )}
      </DataSummaryCard>

      {/* Appearance Summary */}
      <DataSummaryCard title="Aspetto Fisico">
        {basicInfo.height && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Altezza:</span>
            <span className={styles.summaryValue}>{basicInfo.height}</span>
          </div>
        )}
        {basicInfo.weight && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Peso:</span>
            <span className={styles.summaryValue}>{basicInfo.weight}</span>
          </div>
        )}
        {basicInfo.eyeColor && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Occhi:</span>
            <span className={styles.summaryValue}>{basicInfo.eyeColor}</span>
          </div>
        )}
        {basicInfo.hairColor && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Capelli:</span>
            <span className={styles.summaryValue}>{basicInfo.hairColor}</span>
          </div>
        )}
        {basicInfo.visibleMarks && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Segni Visibili:</span>
            <span className={styles.summaryValue}>{basicInfo.visibleMarks}</span>
          </div>
        )}
      </DataSummaryCard>

      {/* Occupation Summary */}
      <DataSummaryCard title="Occupazione">
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Occupazione:</span>
          <span className={styles.summaryValue}>{occupation.currentOccupation || 'Non selezionata'}</span>
        </div>
        {occupation.occupationBonusesApplied && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Bonus Applicati:</span>
            <span className={styles.summaryValue}>✓ Sì</span>
          </div>
        )}
      </DataSummaryCard>

      {/* Stats Summary */}
      <DataSummaryCard title="Statistiche">
        <div className={styles.summaryGrid}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Forza (STR):</span>
            <span className={styles.summaryValue}>{stats.strength}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Destrezza (DEX):</span>
            <span className={styles.summaryValue}>{stats.dexterity}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Intelligenza (INT):</span>
            <span className={styles.summaryValue}>{stats.intelligence}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Costituzione (CON):</span>
            <span className={styles.summaryValue}>{stats.constitution}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Aspetto (APP):</span>
            <span className={styles.summaryValue}>{stats.appearance}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Potere (POW):</span>
            <span className={styles.summaryValue}>{stats.power}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Taglia (SIZ):</span>
            <span className={styles.summaryValue}>{stats.size}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Educazione (EDU):</span>
            <span className={styles.summaryValue}>{stats.education}</span>
          </div>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Totale Punti:</span>
          <span className={styles.summaryValue}>
            {totalStatPoints} / 400 {totalStatPoints === 400 ? '✓' : '⚠️'}
          </span>
        </div>

        <h4 className={styles.subsectionTitle}>Statistiche Derivate</h4>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Punti Ferita:</span>
          <span className={styles.summaryValue}>{derivedStats.hitPoints}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Sanità Mentale:</span>
          <span className={styles.summaryValue}>{derivedStats.sanity}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Tiro Idea:</span>
          <span className={styles.summaryValue}>{derivedStats.ideaRoll}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Bonus Danno:</span>
          <span className={styles.summaryValue}>{derivedStats.bonusDamage}</span>
        </div>
      </DataSummaryCard>

      {/* Skills Summary */}
      <DataSummaryCard title="Abilità">
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Punti Investiti:</span>
          <span className={styles.summaryValue}>{totalSkillPoints}</span>
        </div>
        <h4 className={styles.subsectionTitle}>Abilità con Punteggio &gt;= 40</h4>
        <div className={styles.skillsList}>
          {Object.entries(skills)
            .filter(([_, skill]) => skill.total >= 40)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([skillId, skill]) => (
              <div key={skillId} className={styles.summaryRow}>
                <span className={styles.summaryLabel}>{getSkillName(skillId)}:</span>
                <span className={styles.summaryValue}>{skill.total}</span>
              </div>
            ))}
        </div>
      </DataSummaryCard>
 
      {/* Final Instructions */}
      <div className={styles.section}>
        <div className={styles.infoBox}>
          <strong>Nota:</strong> Una volta inviato, il personaggio sarà messo in stato &quot;In Attesa di
          Approvazione&quot;. Lo staff lo revisionerà e ti notificherà l&apos;esito. Non potrai più modificare il
          personaggio fino all&apos;approvazione.
        </div>
      </div>

      {/* Show all step errors */}
      {Object.values(allErrors).some(errors => Object.keys(errors).length > 0) && (
        <div className={styles.errorSummary}>
          <h4>Errori Per Step:</h4>
          {Object.entries(allErrors).map(([step, errors]) => {
            if (Object.keys(errors).length === 0) return null;
            return (
              <div key={step}>
                <strong>Step {step}:</strong>
                <ul>
                  {Object.entries(errors).map(([field, error]) => (
                    <li key={field}>{error}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
