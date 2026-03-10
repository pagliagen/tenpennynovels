import styles from '@/styles/components/character/wizard/WizardTabBar.module.scss';

const STEP_LABELS: Record<number, string> = {
  1: 'Informazioni base',
  2: 'Esperienze pregresse',
  3: 'Caratteristiche',
  4: 'Abilità',
  5: 'Background',
  6: 'Revisione',
};

export interface WizardTabBarProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  stepValidation: Record<number, boolean>;
}

export function WizardTabBar({ currentStep, onStepClick, stepValidation }: WizardTabBarProps) {
  const steps = [1, 2, 3, 4, 5, 6] as const;

  return (
    <nav className={styles.tabBar} role="tablist" aria-label="Passi del wizard">
      {steps.map((step) => {
        const isValid = stepValidation[step] === true;
        const isActive = currentStep === step;

        return (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Passo ${step}: ${STEP_LABELS[step]}`}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''} ${
              isValid ? styles.tabValid : styles.tabInvalid
            }`}
            onClick={() => onStepClick(step)}
          >
            <span className={styles.tabIcon} aria-hidden>
              {isValid ? '✓' : '✗'}
            </span>
            <span className={styles.tabLabel}>{STEP_LABELS[step]}</span>
          </button>
        );
      })}
    </nav>
  );
}
