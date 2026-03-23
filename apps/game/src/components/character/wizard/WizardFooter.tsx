'use client';

import type { ReactNode } from 'react';

import styles from '@/styles/components/character/wizard/WizardFooter.module.scss';

interface WizardFooterProps {
  currentStep: number;
  totalSteps: number;
  helpText: string;
  onNext: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  customActions?: ReactNode;
}

export function WizardFooter({
  currentStep,
  totalSteps,
  helpText,
  onNext,
  onSubmit,
  isSubmitting = false,
  customActions,
}: WizardFooterProps): JSX.Element {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className={styles.footer}>
      <span className={styles.helpText}>{helpText}</span>
      <div className={styles.actions}>
        {customActions}
        {isLastStep ? (
          <button
            type="button"
            onClick={onSubmit}
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Invio in corso...' : 'Invia per Approvazione'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className={styles.buttonPrimary}
            disabled={isSubmitting}
          >
            Vai avanti
          </button>
        )}
      </div>
    </div>
  );
}
