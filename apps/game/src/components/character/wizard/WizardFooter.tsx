/**
 * Wizard Footer Component
 *
 * Navigation buttons for wizard (Prev, Next, Submit).
 * Handles step transitions and final submission.
 *
 * @module components/character/wizard/WizardFooter
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/character/wizard.module.scss';

/**
 * Wizard Footer Props
 */
interface WizardFooterProps {
  /** Current step (1-6) */
  currentStep: number;

  /** Total steps (6) */
  totalSteps: number;

  /** Callback for Previous button */
  onPrev: () => void;

  /** Callback for Next button */
  onNext: () => void;

  /** Callback for Submit button (Step 6) */
  onSubmit: () => void;

  /** Is submission in progress? */
  isSubmitting?: boolean;
}

/**
 * Wizard Footer Component
 *
 * Navigation buttons with conditional rendering based on current step.
 *
 * **Logic**:
 * - Step 1: Only "Next" button
 * - Steps 2-5: "Previous" and "Next" buttons
 * - Step 6: "Previous" and "Submit" buttons
 *
 * @param {WizardFooterProps} props - Component props
 * @returns {JSX.Element} Wizard footer
 */
export function WizardFooter({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onSubmit,
  isSubmitting = false,
}: WizardFooterProps): JSX.Element {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className={styles.wizardFooter}>
      {/* Left: Previous Button */}
      <div className={styles.footerLeft}>
        {!isFirstStep && (
          <button
            type="button"
            onClick={onPrev}
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={isSubmitting}
          >
            ← Indietro
          </button>
        )}
      </div>

      {/* Center: Help Text */}
      <div className={styles.footerCenter}>
        {isLastStep ? (
          <span className={styles.helpText}>
            Controlla tutti i dati e invia per approvazione
          </span>
        ) : (
          <span className={styles.helpText}>
            Compila tutti i campi per procedere
          </span>
        )}
      </div>

      {/* Right: Next/Submit Button */}
      <div className={styles.footerRight}>
        {isLastStep ? (
          <button
            type="button"
            onClick={onSubmit}
            className={`${styles.button} ${styles.buttonPrimary} ${styles.submitButton}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Invio in corso...' : 'Invia per Approvazione'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={isSubmitting}
          >
            Avanti →
          </button>
        )}
      </div>
    </div>
  );
}
