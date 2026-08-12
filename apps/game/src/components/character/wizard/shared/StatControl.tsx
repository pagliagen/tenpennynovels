/**
 * StatControl - Single stat allocator with numeric input
 *
 * @module components/character/wizard/shared/StatControl
 */

'use client';

import React, { useCallback } from 'react';

import styles from '@/styles/components/character/wizard/StatControl.module.scss';

export interface StatControlProps {
  label: string;
  abbreviation: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  isHigh?: boolean;
}

export function StatControl({
  label,
  abbreviation,
  description,
  value,
  onChange,
  min = 1,
  max = 85,
  isHigh = false,
}: StatControlProps) {
  // Nessun clamp durante la digitazione: il giocatore deve poter scrivere
  // liberamente il valore (es. "3" mentre scrive "35"). Solo verifica che sia
  // numerico, altrimenti ignora il carattere. Min/max/budget sono validati
  // allo step change (validateStep3, wizardValidation.ts) — min/max qui restano
  // solo come hint nativi dell'input.
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') return;
      const next = parseInt(raw, 10);
      if (!Number.isNaN(next)) {
        onChange(next);
      }
    },
    [onChange]
  );

  return (
    <div className={styles.root}>
      <div className={styles.inputWrapper}>
        <input
          type="number"
          className={`${styles.input} ${isHigh ? styles.inputHigh : ''}`}
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          aria-label={`${label} (${abbreviation})`}
        />
        <span className={styles.percent}>%</span>
      </div>
      <div className={styles.textGroup}>
        <span className={styles.label}>{label}</span>
        <span className={styles.description}>{description}</span>
      </div>
    </div>
  );
}
