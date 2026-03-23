import React from 'react';

import styles from '@/styles/components/character/wizard/WizardStepToolbar.module.scss';

export interface WizardStepToolbarProps {
  children: React.ReactNode;
}

export function WizardStepToolbar({ children }: WizardStepToolbarProps) {
  return <div className={styles.toolbar}>{children}</div>;
}
