// =============================================================================
// Character Switcher Component
// =============================================================================

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Character } from '@/lib/auth';
import styles from "@/styles/components/CharacterSwitcher.module.scss";

interface CharacterSwitcherProps {
  currentCharacter: Character | null;
  availableCharacters: Character[];
  onCharacterChange?: (character: Character) => void;
}

export function CharacterSwitcher({ 
  currentCharacter, 
  availableCharacters, 
  onCharacterChange 
}: CharacterSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Don't show switcher if user has only one character
  if (availableCharacters.length <= 1) {
    return null;
  }

  const handleCharacterSelect = (character: Character) => {
    setIsOpen(false);
    
    // Call optional callback
    if (onCharacterChange) {
      onCharacterChange(character);
    }

    // Reload the page with the new characterId parameter
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('characterId', character.id);
    window.location.href = currentUrl.toString();
  };

  const getCharacterDisplayName = (character: Character) => {
    return character.surname ? `${character.name} ${character.surname}` : character.name;
  };

  const getHighestRole = (roles: string[]) => {
    const roleHierarchy = ['amministratore', 'master', 'moderatore', 'personaggio'];
    for (const role of roleHierarchy) {
      if (roles.includes(role)) {
        return role;
      }
    }
    return 'personaggio';
  };

  const getRoleColor = (role: string) => {
    const roleColors: Record<string, string> = {
      amministratore: '#dc2626', // Red
      master: '#d4af37',         // Gold
      moderatore: '#059669',     // Green
      personaggio: '#6b7280'     // Gray
    };
    return roleColors[role] || '#6b7280';
  };

  const getRoleIcon = (role: string) => {
    const roleIcons: Record<string, string> = {
      amministratore: '👑',
      master: '🎭',
      moderatore: '⚖️', 
      personaggio: '👤'
    };
    return roleIcons[role] || '👤';
  };

  return (
    <div className={styles.characterSwitcher}>
      <button
        className={styles.switcherButton}
        onClick={() => setIsOpen(!isOpen)}
        title="Cambia Personaggio"
      >
        <span className={styles.editIcon}>✏️</span>
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <h4>Seleziona Personaggio</h4>
              <button 
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.characterList}>
              {availableCharacters.map((character) => {
                const highestRole = getHighestRole(character.gameplayRoles);
                const isSelected = currentCharacter?.id === character.id;
                
                return (
                  <button
                    key={character.id}
                    className={`${styles.characterOption} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleCharacterSelect(character)}
                  >
                    <div className={styles.characterInfo}>
                      <div className={styles.characterAvatar}>
                        <img src={character.avatarUrl} alt={getCharacterDisplayName(character)} />
                      </div>
                      <div className={styles.characterDetails}>
                        <div className={styles.characterName}>
                          {getCharacterDisplayName(character)}
                        </div>
                        <div 
                          className={styles.characterRole}
                          style={{ color: getRoleColor(highestRole) }}
                        >
                          {getRoleIcon(highestRole)} {highestRole}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className={styles.selectedIndicator}>✓</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}