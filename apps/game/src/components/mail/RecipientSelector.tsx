/**
 * Recipient Selector Component
 *
 * Searchable list for selecting message recipients.
 * Filters out self using useAuthStore.
 * Supports single or multiple selection based on message type limits.
 *
 * @module components/mail/RecipientSelector
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';
import classNames from 'classnames';

import { usePublicCharacters } from '@/hooks/useOnGameMail';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/mail/OnGameMail.module.scss';

interface RecipientSelectorProps {
  value: string[];
  onChange: (ids: string[]) => void;
  maxRecipients: number;
  allowMultiple: boolean;
}

export function RecipientSelector({
  value,
  onChange,
  maxRecipients,
  allowMultiple,
}: RecipientSelectorProps): JSX.Element {
  const [search, setSearch] = useState('');
  const { data: characters = [], isLoading } = usePublicCharacters();
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);

  // Filter out self
  const availableCharacters = characters.filter(
    (c) => c._id !== selectedCharacter?._id
  );

  // Filter by search
  const filteredCharacters = search
    ? availableCharacters.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : availableCharacters;

  const handleSelect = (id: string) => {
    console.log('[RecipientSelector] Selecting:', id, 'Current:', value);
    if (allowMultiple) {
      if (value.includes(id)) {
        // Deselect
        onChange(value.filter((v) => v !== id));
      } else if (value.length < maxRecipients) {
        // Add
        onChange([...value, id]);
      }
    } else {
      // Single select
      onChange([id]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  const selectedCharacters = value
    .map((id) => characters.find((c) => c._id === id))
    .filter(Boolean);

  if (isLoading) {
    return <div className={styles.loading}>Caricamento personaggi...</div>;
  }

  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>
        Destinatari {allowMultiple && `(max ${maxRecipients})`}
      </label>

      {/* Selected recipients display */}
      {selectedCharacters.length > 0 && (
        <div className={styles.recipientSelectedPanel}>
          <div className={styles.recipientSelectedHeading}>
            Selezionati ({selectedCharacters.length}):
          </div>
          <div className={styles.recipientChips}>
            {selectedCharacters.map((char) => (
              <div key={char!._id} className={styles.recipientChip}>
                <span>{char!.name}</span>
                <button
                  type="button"
                  className={styles.recipientChipRemove}
                  onClick={() => handleRemove(char!._id)}
                  title="Rimuovi"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search input */}
      <input
        type="text"
        className={styles.input}
        placeholder="Cerca personaggio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Character list */}
      <div className={styles.recipientList}>
        {filteredCharacters.length === 0 && (
          <div className={styles.recipientListEmpty}>
            {search ? 'Nessun personaggio trovato' : 'Nessun personaggio disponibile'}
          </div>
        )}
        {filteredCharacters.map((char) => {
          const isSelected = value.includes(char._id);
          return (
            <div
              key={char._id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(char._id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(char._id);
                }
              }}
              className={classNames(styles.recipientRow, isSelected && styles.recipientRowSelected)}
            >
              <span className={isSelected ? styles.recipientNameSelected : styles.recipientName}>
                {char.name}
              </span>
              {isSelected && <span className={styles.recipientCheck}>✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
