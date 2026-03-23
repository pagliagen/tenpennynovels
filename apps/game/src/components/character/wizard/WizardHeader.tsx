'use client';

import styles from '@/styles/components/character/wizard/WizardHeader.module.scss';

import { WizardTabBar } from './WizardTabBar';

interface WizardHeaderProps {
  characterName: string;
  currentStep: number;
  onStepClick: (step: number) => void;
  stepValidation: Record<number, boolean>;
}

export function WizardHeader({
  characterName,
  currentStep,
  onStepClick,
  stepValidation,
}: WizardHeaderProps): JSX.Element {
  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <span className={styles.characterName}>{characterName}</span>
        <h1 className={styles.wizardTitle}>Creazione del Personaggio</h1>
      </div>
      <WizardTabBar
        currentStep={currentStep}
        onStepClick={onStepClick}
        stepValidation={stepValidation}
      />
    </div>
  );
}
