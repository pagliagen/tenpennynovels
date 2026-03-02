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
import { BudgetIndicator } from '../shared/BudgetIndicator';
import styles from '@/styles/components/character/wizard.module.scss';

/**
 * Stat definitions with labels
 */
const STATS = [
  { key: 'strength' as const, label: 'Forza (STR)', description: 'Potenza fisica, capacità di sollevare pesi' },
  { key: 'dexterity' as const, label: 'Destrezza (DEX)', description: 'Agilità, coordinazione, riflessi' },
  { key: 'intelligence' as const, label: 'Intelligenza (INT)', description: 'Capacità di ragionamento, memoria, apprendimento' },
  { key: 'constitution' as const, label: 'Costituzione (CON)', description: 'Salute, resistenza fisica, vigore' },
  { key: 'appearance' as const, label: 'Aspetto (APP)', description: 'Bellezza, carisma fisico, presenza' },
  { key: 'power' as const, label: 'Potere (POW)', description: 'Forza di volontà, resistenza mentale, magia' },
  { key: 'size' as const, label: 'Taglia (SIZ)', description: 'Massa corporea, altezza e peso' },
  { key: 'education' as const, label: 'Educazione (EDU)', description: 'Conoscenza acquisita, istruzione formale' },
];

/**
 * Step 3: Stats Component
 *
 * @returns {JSX.Element} Step 3 form
 */
export function Step3Stats(): JSX.Element {
  const { stats, derivedStats, updateStat, stepErrors } = useWizardStore();
  const errors = stepErrors[3] || {};

  // Calculate total points (all stats count toward 400 budget)
  const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
  const statsAbove80 = Object.values(stats).filter((val) => val > 80).length;

  return (
    <div className={styles.stepContent} data-step="stats">
      <h2 className={styles.stepTitle}>Statistiche</h2>
      <p className={styles.stepDescription}>
        Distribuisci <strong>400 punti</strong> tra le 8 statistiche base. Massimo 2 statistiche possono superare 80, e nessuna può superare 85.
      </p>

      {/* Budget Indicator */}
      <BudgetIndicator spent={total} total={400} label="Punti Statistiche" />

      {/* Warnings */}
      {statsAbove80 > 2 && (
        <div className={styles.warningBox}>
          ⚠️ Hai {statsAbove80} statistiche sopra 80. Massimo consentito: 2
        </div>
      )}

      {/* Stats Allocator */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Statistiche Base</h3>

        <div className={styles.statsGrid}>
          {STATS.map((stat) => (
            <div key={stat.key} className={styles.statItem}>
              <div className={styles.statHeader}>
                <label htmlFor={stat.key} className={styles.statLabel}>
                  {stat.label}
                </label>
                <span className={styles.statValue}>{stats[stat.key]}</span>
              </div>
              <input
                type="range"
                id={stat.key}
                min={1}
                max={85}
                value={stats[stat.key]}
                onChange={(e) => updateStat(stat.key, parseInt(e.target.value))}
                className={`${styles.statSlider} ${stats[stat.key] > 80 ? styles.statSliderHigh : ''}`}
              />
              <div className={styles.statControls}>
                <button
                  type="button"
                  onClick={() => updateStat(stat.key, Math.max(1, stats[stat.key] - 5))}
                  className={styles.statButton}
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => updateStat(stat.key, Math.max(1, stats[stat.key] - 1))}
                  className={styles.statButton}
                >
                  -1
                </button>
                <input
                  type="number"
                  value={stats[stat.key]}
                  onChange={(e) => updateStat(stat.key, parseInt(e.target.value) || 0)}
                  min={1}
                  max={85}
                  className={styles.statInput}
                />
                <button
                  type="button"
                  onClick={() => updateStat(stat.key, Math.min(85, stats[stat.key] + 1))}
                  className={styles.statButton}
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => updateStat(stat.key, Math.min(85, stats[stat.key] + 5))}
                  className={styles.statButton}
                >
                  +5
                </button>
              </div>
              <small className={styles.statDescription}>{stat.description}</small>
            </div>
          ))}
        </div>
      </div>

      {/* Derived Stats Display */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Statistiche Derivate</h3>
        <p className={styles.helpText}>
          Queste statistiche vengono calcolate automaticamente in base alle tue statistiche base.
        </p>

        <div className={styles.derivedStatsGrid}>
          <div className={styles.derivedStat}>
            <span className={styles.derivedStatLabel}>Punti Ferita (HP)</span>
            <span className={styles.derivedStatValue}>{derivedStats.hitPoints}</span>
            <small className={styles.derivedStatFormula}>= (CON + SIZ) / 10</small>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedStatLabel}>Sanità Mentale</span>
            <span className={styles.derivedStatValue}>{derivedStats.sanity}</span>
            <small className={styles.derivedStatFormula}>= POW</small>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedStatLabel}>Punti Magia (MP)</span>
            <span className={styles.derivedStatValue}>{derivedStats.magicPoints}</span>
            <small className={styles.derivedStatFormula}>= POW / 5</small>
          </div>
          <div className={styles.derivedStat}>
            <span className={styles.derivedStatLabel}>Fortuna</span>
            <span className={styles.derivedStatValue}>{derivedStats.luck}</span>
            <small className={styles.derivedStatFormula}>= POW</small>
          </div>
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
  );
}
