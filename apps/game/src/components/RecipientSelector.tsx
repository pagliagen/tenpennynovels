/**
 * Recipient Selector Component
 *
 * Character selector for OnGame mail and OffGame chat.
 * Supports single and multiple selection with autocomplete.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { charactersApi, type CharacterListItem } from '@/lib/api/characters';
import styles from './RecipientSelector.module.scss';

interface RecipientSelectorProps {
  value: string[];
  onChange: (recipients: string[]) => void;
  maxRecipients?: number;
  allowMultiple?: boolean;
}

export function RecipientSelector({
  value,
  onChange,
  maxRecipients = 1,
  allowMultiple = false,
}: RecipientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch character directory with debounced search
  const { data: directoryData } = useQuery({
    queryKey: ['characters', 'directory', searchQuery],
    queryFn: () => charactersApi.getDirectory(1, 25, searchQuery || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: isDropdownOpen, // Only fetch when dropdown is open
  });

  const availableCharacters = useMemo(() => {
    const characters = directoryData?.data.characters || [];
    // Filter out already selected characters
    return characters.filter((char) => !value.includes(char._id));
  }, [directoryData, value]);

  // Get character display name
  const getCharacterName = useCallback((characterId: string) => {
    const character = directoryData?.data.characters.find((c) => c._id === characterId);
    if (character) {
      return character.surname ? `${character.name} ${character.surname}` : character.name;
    }
    return characterId; // Fallback to ID if not found
  }, [directoryData]);

  const handleSelect = (character: CharacterListItem) => {
    if (!allowMultiple && value.length >= 1) {
      onChange([character._id]); // Replace single selection
    } else if (value.length < maxRecipients) {
      onChange([...value, character._id]);
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleRemove = (characterId: string) => {
    onChange(value.filter((id) => id !== characterId));
  };

  const canAddMore = allowMultiple ? value.length < maxRecipients : value.length < 1;

  return (
    <div className={styles.recipientSelector}>
      <label>
        {allowMultiple ? 'Destinatari' : 'Destinatario'}
        {maxRecipients > 1 && ` (max ${maxRecipients})`}
      </label>

      {/* Selected recipients */}
      {value.length > 0 && (
        <div className={styles.selectedList}>
          {value.map((characterId) => (
            <div key={characterId} className={styles.selectedItem}>
              <span>{getCharacterName(characterId)}</span>
              <button
                type="button"
                onClick={() => handleRemove(characterId)}
                className={styles.removeButton}
                aria-label="Rimuovi"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Autocomplete input */}
      {canAddMore && (
        <div className={styles.inputGroup}>
          <div className={styles.autocompleteWrapper}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => {
                // Delay to allow click on dropdown
                setTimeout(() => setIsDropdownOpen(false), 200);
              }}
              placeholder="Cerca personaggio per nome..."
              className={styles.input}
            />

            {/* Dropdown results */}
            {isDropdownOpen && availableCharacters.length > 0 && (
              <div className={styles.dropdown}>
                {availableCharacters.map((character) => (
                  <button
                    key={character._id}
                    type="button"
                    onClick={() => handleSelect(character)}
                    className={styles.dropdownItem}
                  >
                    {character.avatar && (
                      <img
                        src={character.avatar}
                        alt={character.name}
                        className={styles.avatar}
                      />
                    )}
                    <span className={styles.characterName}>
                      {character.surname
                        ? `${character.name} ${character.surname}`
                        : character.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {isDropdownOpen && searchQuery && availableCharacters.length === 0 && (
              <div className={styles.dropdown}>
                <div className={styles.noResults}>Nessun personaggio trovato</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
