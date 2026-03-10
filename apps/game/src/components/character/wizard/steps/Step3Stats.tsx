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

import { useWizardStore } from '@/store/wizardStore';
import { useOccupations } from '@/hooks/useCharacterCreation';
import { useWizardToolbar } from '../WizardSlotsContext';
import { StatControl } from '../shared/StatControl';
import { DerivedStatCard } from '../shared/DerivedStatCard';
import Image from 'next/image';
import { getOccupationImage } from '../shared/OccupationIconMap';
import styles from '@/styles/components/character/wizard/Step3Stats.module.scss';

const STATS = [
  { key: 'strength' as const, label: 'Forza (FOR)', abbreviation: 'FOR', description: 'Potenza fisica, capacità di sollevare pesi' },
  { key: 'dexterity' as const, label: 'Destrezza (DES)', abbreviation: 'DES', description: 'Agilità, coordinazione, riflessi' },
  { key: 'intelligence' as const, label: 'Intelligenza (INT)', abbreviation: 'INT', description: 'Capacità di ragionamento, memoria' },
  { key: 'constitution' as const, label: 'Costituzione (COS)', abbreviation: 'COS', description: 'Salute, resistenza fisica' },
  { key: 'appearance' as const, label: 'Carisma (CHA)', abbreviation: 'CHA', description: 'Fascino, presenza, carisma personale' },
  { key: 'power' as const, label: 'Potere (POT)', abbreviation: 'POT', description: 'Forza di volontà, resistenza mentale' },
  { key: 'size' as const, label: 'Taglia (TAG)', abbreviation: 'TAG', description: 'Massa corporea, altezza, corporatura' },
  { key: 'education' as const, label: 'Educazione (EDU)', abbreviation: 'EDU', description: 'Istruzione formale, conoscenza acquisita' },
];

/**
 * Step 3: Stats Component
 *
 * @returns {JSX.Element} Step 3 form
 */
export function Step3Stats(): JSX.Element {
  const { stats, derivedStats, updateStat, stepErrors, occupation } = useWizardStore();
  const { data: occupations } = useOccupations();
  const errors = stepErrors[3] || {};
  const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
  const remaining = 400 - total;
  const statsAbove80 = Object.values(stats).filter((v) => v > 80).length;

  const selectedOcc = occupations?.find((o) => o.id === occupation.occupationId);
  const occImage = selectedOcc ? getOccupationImage(selectedOcc.image) : null;

  useWizardToolbar(() => (
    <>
      <div className={styles.toolbarLeft}>
        {occImage && (
          <Image
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
          className={`${styles.pointsValue} ${total === 400 ? styles.pointsValid : total > 400 ? styles.pointsExceeded : ''}`}
        >
          utilizzati {total}/400 | rimanenti {remaining}
        </span>
      </div>
    </>
  ), [occImage, selectedOcc?.name, total, remaining]);

  return (
    <div className={styles.stepContent} data-step="stats">

      {statsAbove80 > 2 && (
        <div className={styles.warningBox}>
          ⚠️ Hai {statsAbove80} statistiche sopra 80. Massimo consentito: 2
        </div>
      )}

      <div className={styles.panels}>
        <div className={styles.panelLeft}>
          <h3 className={styles.panelTitle}>CARATTERISTICHE PRINCIPALI</h3>
          <p className={styles.panelDescription}>
            Distribuisci 400 punti tra le 8 statistiche. Massimo 2 statistiche possono superare 80, nessuna può superare 85.
          </p>
          <div className={styles.statsGrid}>
            {STATS.map((stat) => (
              <StatControl
                key={stat.key}
                label={stat.label}
                abbreviation={stat.abbreviation}
                description={stat.description}
                value={stats[stat.key]}
                onChange={(v) => updateStat(stat.key, v)}
                isHigh={stats[stat.key] > 80}
              />
            ))}
          </div>
        </div>

        <div className={styles.panelRight}>
          <h3 className={styles.panelTitle}>CARATTERISTICHE DERIVATE</h3>
          <p className={styles.panelDescription}>
            Calcolate automaticamente dalle statistiche principali.
          </p>
          <div className={styles.derivedGrid}>
            <DerivedStatCard label="Punti Vita" value={derivedStats.hitPoints} formula="= (COS + TAG) / 10" />
            <DerivedStatCard label="Sanità Mentale" value={derivedStats.sanity} formula="= POT" />
            <DerivedStatCard label="Punti Magia" value={derivedStats.magicPoints} formula="= POT / 5" />
            <DerivedStatCard label="Fortuna" value={derivedStats.luck} formula="= POT" />
          </div>
        </div>
      </div>

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
  );
}
