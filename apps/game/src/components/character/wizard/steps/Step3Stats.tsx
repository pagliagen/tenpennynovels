/**
 * Step 3: Stats Component
 *
 * Stat allocation with budget enforcement (400 points total).
 * Includes derived stats display.
 *
 * @module components/character/wizard/steps/Step3Stats
 * @since 2.0.0
 */

'use client';

import { useOccupations } from '@/hooks/useCharacterCreation';
import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/Step3Stats.module.scss';

import { DerivedStatCard } from '../shared/DerivedStatCard';
import { getOccupationImage } from '../shared/OccupationIconMap';
import { StatControl } from '../shared/StatControl';
import { useWizardToolbar } from '../WizardSlotsContext';
import { WarningIcon } from '../WarningIcon';


const STATS = [
  { key: 'strength' as const, label: 'Forza (FOR)', abbreviation: 'FOR', description: 'Potenza fisica, capacità di sollevare, spingere.' },
  { key: 'dexterity' as const, label: 'Destrezza (DES)', abbreviation: 'DES', description: 'Agilità, coordinazione, velocità di reazione.' },
  { key: 'intelligence' as const, label: 'Intelligenza (INT)', abbreviation: 'INT', description: 'Capacità di ragionamento, memoria e apprendimento.' },
  { key: 'constitution' as const, label: 'Costituzione (COS)', abbreviation: 'COS', description: 'Salute, resistenza, sopportazione fatica.' },
  { key: 'appearance' as const, label: 'Carisma (CAR)', abbreviation: 'CAR', description: 'Fascino, presenza, carisma personale.' },
  { key: 'size' as const, label: 'Taglia (TAG)', abbreviation: 'TAG', description: 'Massa corporea, altezza, corporatura.' },
  { key: 'power' as const, label: 'Potere (POT)', abbreviation: 'POT', description: 'Forza di volontà, resistenza mentale, intuito.' },
  { key: 'education' as const, label: 'Educazione (EDU)', abbreviation: 'EDU', description: 'Istruzione formale, conoscenze acquisite.' },
];

/**
 * Step 3: Stats Component
 *
 * @returns {JSX.Element} Step 3 form
 */
export function Step3Stats(): JSX.Element {
  const { stats, derivedStats, updateStat, stepErrors, occupation, creationConfig } = useWizardStore();
  const { data: occupations } = useOccupations();
  const errors = stepErrors[3] || {};

  // Get config values (fallback to defaults if not loaded yet)
  const TOTAL_STAT_POINTS = creationConfig?.stats.totalPoints ?? 450;
  const MAX_STATS_ABOVE_80 = creationConfig?.stats.maxStatsAbove80 ?? 2;
  const MIN_STAT_VALUE = creationConfig?.stats.minValue ?? 20;
  const MAX_STAT_VALUE = creationConfig?.stats.creationCap ?? 85;

  // Type assertion safe: WizardStats declared properties are all number (index signature allows undefined for dynamic access only)
  const total = (Object.values(stats) as number[]).reduce((sum, val) => sum + val, 0);
  const remaining = TOTAL_STAT_POINTS - total;
  const statsAbove80 = (Object.values(stats) as number[]).filter((v) => v > 80).length;

  const selectedOcc = occupations?.find((o) => o.id === occupation.occupationId);
  const occImage = selectedOcc ? getOccupationImage(selectedOcc.image) : null;
  const combinedError = Object.values(errors).filter(Boolean).join(' — ');

  useWizardToolbar(() => (
    <>
      <div className={styles.toolbarLeft}>
        {occImage && (
          <img
            src={occImage}
            alt={selectedOcc?.name || 'Occupazione'}
            width={28}
            height={28}
            className={styles.occIcon}
          />
        )}
      </div>
      <div className={styles.pointsSummary}>
        <span className={styles.pointsLabel}>RIEPILOGO PUNTI:</span>
        <span
          className={`${styles.pointsValue} ${total === TOTAL_STAT_POINTS ? styles.pointsValid : total > TOTAL_STAT_POINTS ? styles.pointsExceeded : ''}`}
        >
          utilizzati {total}/{TOTAL_STAT_POINTS} | rimanenti {remaining}
        </span>
      </div>
    </>
  ), [occImage, selectedOcc?.name, total, remaining]);

  return (
    <div className={styles.stepContent} data-step="stats">

      {statsAbove80 > MAX_STATS_ABOVE_80 && (
        <div className={styles.warningBox}>
          ⚠️ Hai {statsAbove80} statistiche sopra 80. Massimo consentito: {MAX_STATS_ABOVE_80}
        </div>
      )}

      <div className={styles.panels}>
        <div className={styles.panelLeft}>
          <h3 className={styles.panelTitle}>CARATTERISTICHE PRINCIPALI <WarningIcon message={combinedError} /></h3>
          <div className={styles.statsGrid}>
            {STATS.map((stat) => (
              <StatControl
                key={stat.key}
                label={stat.label}
                abbreviation={stat.abbreviation}
                description={stat.description}
                value={stats[stat.key]}
                onChange={(v) => updateStat(stat.key, v)}
                min={MIN_STAT_VALUE}
                max={MAX_STAT_VALUE}
                isHigh={stats[stat.key] > 80}
              />
            ))}
          </div>
        </div>

        <div className={styles.panelRight}>
          <h3 className={styles.panelTitle}>CARATTERISTICHE DERIVATE</h3>
          <p className={styles.panelDescription}>
            Le caratteristiche derivate si calcolano automaticamente sulla base dei punteggi delle caratteristiche principali.
          </p>
          <div className={styles.derivedGrid}>
            <DerivedStatCard
              label="Punti Vita"
              value={derivedStats.hitPoints}
              formula="COS + TAG : 10"
              description="Resistenza fisica prima di perdere conoscenza o morire. A 0 PV incosciente, a -2 morto."
            />
            <DerivedStatCard
              label="Sanità Mentale"
              value={derivedStats.sanity}
              formula="= POT"
              description="Resistenza alla follia. Diminuisce affrontando orrori soprannaturali. Max 99%."
            />
            <DerivedStatCard
              label="Tiro Idea"
              value={derivedStats.ideaRoll}
              formula="= INT"
              description="Lampo di intuizione per collegare indizi o ricordare informazioni cruciali."
            />
            <DerivedStatCard
              label="Bonus Danno"
              value={derivedStats.bonusDamage}
              formula="FOR + TAG"
              description="Danni extra in combattimento corpo a corpo, calcolati dalla tabella BD."
            />
          </div>
        </div>
      </div>

    </div>
  );
}
