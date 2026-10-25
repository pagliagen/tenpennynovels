/**
 * LocationTagsEditor - scelta dei tag di una location dal registro (elenco chiuso).
 *
 * I tag dicono al bot cosa c'è in un luogo («qui si dorme», «qui c'è un parco»):
 * senza, non può indicarlo ai giocatori e risponde «non so».
 */

import React from 'react';
import { useLocationTags } from '@/hooks/api/useLocations';
import styles from '@/styles/components/CreateLocationModal.module.scss';

interface LocationTagsEditorProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function LocationTagsEditor({ value, onChange }: LocationTagsEditorProps): React.ReactElement {
  const { data: options, isLoading, error } = useLocationTags();

  if (isLoading) return <p className={styles.tagHint}>Caricamento tag...</p>;
  if (error || !options) return <p className={styles.tagHint}>Tag non disponibili.</p>;

  const toggle = (tag: string): void => {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  };

  const hovered = options.filter((o) => value.includes(o.tag));

  return (
    <div>
      <div className={styles.tagGrid}>
        {options.map((option) => {
          const on = value.includes(option.tag);
          return (
            <button
              key={option.tag}
              type="button"
              title={option.hint}
              aria-pressed={on}
              className={`${styles.tagChip} ${on ? styles.tagChipOn : ''}`}
              onClick={() => toggle(option.tag)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hovered.length > 0 && (
        <p className={styles.tagHint}>{hovered.map((o) => o.hint).join(' · ')}</p>
      )}
    </div>
  );
}
