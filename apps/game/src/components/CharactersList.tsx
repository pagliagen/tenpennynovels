import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useGame } from '@/contexts/GameContext';
import { useCharacterSheets } from '@/contexts/CharacterSheetsContext';
import styles from '../styles/components/CharactersList.module.scss';
import { getLocationNameById } from '@/utils/cache';
import type { GlobalPresenceCharacter } from '@/contexts/GameContext';

interface CharactersListProps {
  characters: GlobalPresenceCharacter[];
  currentCharacterLocation: string | null;
  currentCharacterId: string;
}

export const CharactersList: React.FC<CharactersListProps> = ({
  characters: initialCharacters,
  currentCharacterLocation,
  currentCharacterId
}) => {
  // Get clean states from context
  const { character, globalPresence, updateGlobalPresence } = useGame();
  const { openCharacterSheet } = useCharacterSheets();
  const { onPresenceUpdate } = useWebSocket();
  const router = useRouter();

  // ARCHITETTURA PULITA: Usa solo character.currentLocationId + globalPresence
  const currentLocationId = character?.currentLocationId || null;

  // Filtra globalPresence per la location corrente
  const getCharactersInLocation = () => {
    if (!globalPresence) return [];

    return globalPresence.filter(char => {
      // Normalize empty string to null for London
      const charLocationId = char.locationId === '' ? null : char.locationId;
      const filterLocationId = currentLocationId === '' ? null : currentLocationId;

      // Both null/empty (London) or both same location ID
      if ((filterLocationId === null || filterLocationId === '') &&
        (charLocationId === null || charLocationId === '')) {
        return true; // Both at London
      }

      return charLocationId === filterLocationId;
    });
  };

  // Lista characters sempre aggiornata
  const characters = getCharactersInLocation();

  // WebSocket: ascolta eventi di presenza per aggiornamento real-time
  useEffect(() => {
    const unsubscribe = onPresenceUpdate((update) => {
      // Se l'update ha globalPresence, è un full update dal ping
      if ((update as any).globalPresence) {
        updateGlobalPresence((update as any).globalPresence);
      } 
      // Altrimenti è un evento individuale di movimento
      else if (update.type === 'character_entered_location' && update.characterId && update.locationId) {
        // Aggiorna globalPresence: aggiorna la location del personaggio
        const locationName = getLocationNameById(update.locationId);
        const updatedPresence = globalPresence.map(char =>
          char.characterId === update.characterId
            ? { ...char, locationId: update.locationId, locationName: locationName || 'Unknown Location' }
            : char
        );
        updateGlobalPresence(updatedPresence);
      }
      // Handle character_left_location
      else if (update.type === 'character_left_location' && update.characterId && update.locationId) {
        // Per ora aggiorniamo la location del personaggio - il backend dovrebbe dire dove è andato
        const updatedPresence = globalPresence.map(char =>
          char.characterId === update.characterId
            ? { ...char, locationId: null, locationName: 'London' } // Assume tornato a London per ora
            : char
        );
        updateGlobalPresence(updatedPresence);
      }
    });
    return unsubscribe;
  }, [onPresenceUpdate, updateGlobalPresence, globalPresence]);

  // I personaggi sono già filtrati per la location corrente
  const sameLocationCharacters = characters;

  // Get current location name for display
  const getCurrentLocationDisplayName = () => {
    // If current character location is null or empty, we're in London
    if (currentLocationId === null || currentLocationId === '') {
      return 'London';
    }

    // Find location name from current character in globalPresence
    const currentCharInGlobalPresence = globalPresence?.find(char => char.isCurrentCharacter);
    if (currentCharInGlobalPresence?.locationName) {
      return currentCharInGlobalPresence.locationName;
    }

    return 'Unknown Location';
  };

  const currentLocationName = getCurrentLocationDisplayName();

  // Handle character click to open character sheet
  const handleCharacterClick = (char: GlobalPresenceCharacter) => {
    // For current character, check if it's DRAFT
    if (char.isCurrentCharacter && character) {
      // If it's my character and it's in DRAFT status, navigate to wizard
      if (character.status === 'DRAFT') {
        router.push('/character/wizard');
        return;
      }

      // Otherwise open character sheet with character data
      openCharacterSheet(
        char.characterId,
        char.characterName,
        char.avatar || undefined,
        undefined, // audioTheme will be fetched
        character // Full character data from context
      );
    } else {
      // For other characters, we'll need to fetch their data
      // For now, just open with basic info
      openCharacterSheet(
        char.characterId,
        char.characterName,
        char.avatar || undefined
      );
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>PRESENTI</h3>
      </div>

      <div className={styles.charactersList}>
        {sameLocationCharacters.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>👻</span>
            <span className={styles.emptyText}>Nessuno presente</span>
          </div>
        ) : (
          sameLocationCharacters.map((char) => (
            <div
              key={char.characterId}
              className={`${styles.character} ${char.isCurrentCharacter ? styles.currentCharacter : ''
                }`}
              onClick={() => handleCharacterClick(char)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.characterIcon}>
                {char.avatar ? (
                  <img
                    src={char.avatar}
                    alt={`${char.characterName} avatar`}
                    className={styles.avatarImage}
                  />
                ) : (
                  <span className={styles.defaultIcon}>
                    {char.isCurrentCharacter ? '👤' : '🎭'}
                  </span>
                )}
              </div>
              <div className={styles.characterInfo}>
                <div className={styles.characterName}>
                  {char.characterName}
                  {char.characterSurname && ` ${char.characterSurname}`}
                  {char.isCurrentCharacter && (
                    <span className={styles.youLabel}> (Tu)</span>
                  )}
                </div>
                <div className={styles.characterStatus}>
                  {character && char.isCurrentCharacter ? (
                    <>
                      {character.status === 'DRAFT' && (
                        <div className={styles.draftStatus}>
                          📝 Bozza -
                          <Link href="/character/wizard" className={styles.wizardLink}>
                            Completa Personaggio
                          </Link>
                        </div>
                      )}
                      {character.status === 'PENDING_APPROVAL' && (
                        <div className={styles.pendingStatus}>
                          ⏳ In attesa di approvazione
                        </div>
                      )}
                      {character.status === 'APPROVED' && (
                        <div className={styles.approvedStatus}>
                          🟢 Online
                        </div>
                      )}
                      {!character.status && (
                        <div className={styles.unknownStatus}>
                          🟢 Online
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.otherPlayerStatus}>
                      🟢 Online
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {sameLocationCharacters.length > 1 && (
        <div className={styles.footer}>
          <span className={styles.count}>
            {sameLocationCharacters.length} {sameLocationCharacters.length === 1 ? 'personaggio' : 'personaggi'}
          </span>
        </div>
      )}
    </div>
  );
};