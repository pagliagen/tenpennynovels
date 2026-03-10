/**
 * StatControl - Single stat allocator with slider and increment/decrement buttons
 *
 * @module components/character/wizard/shared/StatControl
 */

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = parseInt(e.target.value, 10);
      if (!Number.isNaN(next)) {
        onChange(clamp(next, min, max));
      }
    },
    [onChange, min, max]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') return;
      const next = parseInt(raw, 10);
      if (!Number.isNaN(next)) {
        onChange(clamp(next, min, max));
      }
    },
    [onChange, min, max]
  );

  const adjust = useCallback(
    (delta: number) => {
      onChange(clamp(value + delta, min, max));
    },
    [value, onChange, min, max]
  );

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={isHigh ? styles.valueHigh : styles.value}>{value}</span>
      </div>

      <input
        type="range"
        className={isHigh ? styles.sliderHigh : styles.slider}
        min={min}
        max={max}
        value={value}
        onChange={handleSliderChange}
        aria-label={`${label} (${abbreviation})`}
      />

      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => adjust(-5)}
          aria-label={`${abbreviation} -5`}
        >
          -5
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => adjust(-1)}
          aria-label={`${abbreviation} -1`}
        >
          -1
        </button>
        <input
          type="number"
          className={styles.input}
          min={min}
          max={max}
          value={value}
          onChange={handleInputChange}
          aria-label={abbreviation}
        />
        <button
          type="button"
          className={styles.btn}
          onClick={() => adjust(1)}
          aria-label={`${abbreviation} +1`}
        >
          +1
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => adjust(5)}
          aria-label={`${abbreviation} +5`}
        >
          +5
        </button>
      </div>

      <p className={styles.description}>{description}</p>
    </div>
  );
}
