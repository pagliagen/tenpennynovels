/**
 * Wizard Header Component
 *
 * Displays step indicator and progress bar.
 * Shows which step user is on (1-6) with visual progress.
 *
 * @module components/character/wizard/WizardHeader
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/character/wizard.module.scss';

/**
 * Wizard Header Props
 */
interface WizardHeaderProps {
  /** Current step (1-6) */
  currentStep: number;

  /** Total steps (6) */
  totalSteps: number;
}

/**
 * Step Labels
 */
const STEP_LABELS = [
  'Info Base',
  'Occupazione',
  'Statistiche',
  'Abilità',
  'Background',
  'Revisione',
];

/**
 * Wizard Header Component
 *
 * Progress indicator with step labels and progress bar.
 *
 * @param {WizardHeaderProps} props - Component props
 * @returns {JSX.Element} Wizard header
 */
export function WizardHeader({ currentStep, totalSteps }: WizardHeaderProps): JSX.Element {
  const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className={styles.wizardHeader}>
      <h1 className={styles.wizardTitle}>Creazione Personaggio</h1>

      {/* Step Indicator */}
      <div className={styles.stepIndicator}>
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`${styles.stepItem} ${
              step === currentStep ? styles.active : ''
            } ${step < currentStep ? styles.completed : ''}`}
          >
            <div className={styles.stepNumber}>{step}</div>
            <div className={styles.stepLabel}>{STEP_LABELS[step - 1]}</div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Counter */}
      <div className={styles.stepCounter}>
        Step {currentStep} di {totalSteps}
      </div>
    </div>
  );
}
