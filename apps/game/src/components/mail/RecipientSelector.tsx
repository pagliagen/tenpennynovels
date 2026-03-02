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
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem',
            background: 'rgba(255, 149, 0, 0.15)',
            borderRadius: '4px',
            border: '1px solid rgba(255, 149, 0, 0.4)',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: '#ffd700', marginBottom: '0.5rem', fontWeight: 600 }}>
            Selezionati ({selectedCharacters.length}):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedCharacters.map((char) => (
              <div
                key={char!._id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(139, 69, 19, 0.8)',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: '#ffe4b5',
                }}
              >
                <span>{char!.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(char!._id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff9500',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '1rem',
                    lineHeight: '1',
                  }}
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
      <div
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '0.5rem',
          border: '1px solid rgba(139, 69, 19, 0.6)',
          borderRadius: '4px',
          background: 'rgba(20, 20, 20, 0.8)',
        }}
      >
        {filteredCharacters.length === 0 && (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
            {search ? 'Nessun personaggio trovato' : 'Nessun personaggio disponibile'}
          </div>
        )}
        {filteredCharacters.map((char) => {
          const isSelected = value.includes(char._id);
          return (
            <div
              key={char._id}
              onClick={() => handleSelect(char._id)}
              style={{
                padding: '0.75rem',
                cursor: 'pointer',
                background: isSelected
                  ? 'rgba(255, 149, 0, 0.3)'
                  : 'transparent',
                borderBottom: '1px solid rgba(139, 69, 19, 0.3)',
                borderLeft: isSelected ? '3px solid #ff9500' : '3px solid transparent',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(60, 40, 20, 0.8)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ color: isSelected ? '#ffd700' : '#e8e0d5' }}>
                {char.name}
              </span>
              {isSelected && (
                <span style={{ color: '#ff9500', fontSize: '1.125rem' }}>✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
