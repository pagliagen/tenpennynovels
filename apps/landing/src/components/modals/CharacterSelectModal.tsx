/**
 * Character Select Modal
 *
 * Modal for choosing a character after login. Lists characters as cards;
 * each card is clickable to enter the game. Includes logout.
 *
 * @module components/modals/CharacterSelectModal
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { authService } from '@/services/AuthService';
import { characterService } from '@/services/CharacterService';
import type { Character } from '@/types';

const FALLBACK_AVATAR =
  `${process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:4001'}/images/sidebar/miniavatar_default.png`;

interface CharacterSelectModalProps {
  isOpen: boolean;
  characters: Character[];
  username: string;
  onClose?: () => void;
}

/** Renders the character selection modal or null when closed. */
export function CharacterSelectModal({
  isOpen,
  characters,
  username,
  onClose,
}: CharacterSelectModalProps): JSX.Element | null {
  const router = useRouter();
  const [selecting, setSelecting] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSelectCharacter = async (characterId: string) => {
    try {
      setSelecting(characterId);
      setError('');

      const result = await characterService.selectCharacter(characterId);

      if (result.success) {
        // Redirect to game
        window.location.href = process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:3010';
      } else {
        setError(result.error || 'Errore durante la selezione del personaggio');
      }
    } catch (error) {
      console.error('Character selection failed:', error);
      setError('Errore di connessione durante la selezione');
    } finally {
      setSelecting('');
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      onClose?.();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="character-select-modal">
      <div
        className="character-select-modal__overlay"
        onClick={(e) => e.stopPropagation()}
        aria-hidden
      />

      <div className="character-select-modal__container">
        <h2 className="character-select-modal__title">
          Selezione personaggio
        </h2>

        {error && (
          <Alert type="error" message={error} dismissible onDismiss={() => setError('')} />
        )}

        {characters && characters.length > 0 ? (
          <>
            <h3 className="character-select-modal__section-title">
              I tuoi personaggi:
            </h3>
            <div className="character-select-modal__list">
              {characters.map((character) => (
                <Card
                  key={character.id}
                  character={character}
                  fallbackAvatarUrl={FALLBACK_AVATAR}
                  onSelectCharacter={handleSelectCharacter}
                  selectingId={selecting}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="character-select-modal__empty">
            <p>Non hai ancora nessun personaggio.</p>
          </div>
        )}

        <div className="character-select-modal__actions">
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogout}
            className="character-select-modal__logout-button"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
