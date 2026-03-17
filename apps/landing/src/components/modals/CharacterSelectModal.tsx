/**
 * Character Select Modal
 *
 * Modal popup for character selection after login.
 * Replaces character-select.tsx page with inline modal experience.
 *
 * **Features**:
 * - Character type badges (Master, PNG)
 * - Status indicators
 * - Select character to enter game
 * - Create new character button
 * - Logout button
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

interface CharacterSelectModalProps {
  isOpen: boolean;
  characters: Character[];
  username: string;
  onClose?: () => void;
}

/**
 * Character status text mappings
 */
const CHARACTER_STATUS_TEXT: Record<string, string> = {
  draft: 'Bozza',
  pending: 'In attesa',
  approved: 'Disponibile',
  rejected: 'Rifiutato',
};

/**
 * Character Select Modal Component
 *
 * Popup modal for character selection with type badges.
 *
 * @returns {JSX.Element | null} Character select modal
 */
export function CharacterSelectModal({
  isOpen,
  characters,
  username,
  onClose,
}: CharacterSelectModalProps): JSX.Element | null {
  const router = useRouter();
  const [selecting, setSelecting] = useState<string>('');
  const [error, setError] = useState<string>('');

  /**
   * Handle character selection
   */
  const handleSelectCharacter = async (characterId: string) => {
    try {
      setSelecting(characterId);
      setError('');

      const result = await characterService.selectCharacter(characterId);

      if (result.result) {
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

  /**
   * Handle logout button
   */
  const handleLogout = async () => {
    try {
      await authService.logout();
      onClose?.();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Check if character can be selected
   */
  const canSelectCharacter = (character: any) => {
    const status = character.playerStatus?.toLowerCase();
    return status === 'approved' || status === 'draft' || status === 'pending';
  };

  /**
   * Get character type badge
   */
  const getCharacterTypeBadge = (character: Character) => {
    const characterType = (character as any).characterType;

    if (characterType === 'pg_master') {
      return (
        <span className="character-select-modal__badge character-select-modal__badge--master">
          MASTER
        </span>
      );
    }

    if (characterType === 'png') {
      return (
        <span className="character-select-modal__badge character-select-modal__badge--png">
          PNG
        </span>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="character-select-modal">
      {/* Modal Overlay */}
      <div
        className="character-select-modal__overlay"
        onClick={(e) => {
          e.stopPropagation();
          // Don't allow closing by clicking overlay (must select character or logout)
        }}
      />

      {/* Modal Content */}
      <div className="character-select-modal__container">
        <h2 className="character-select-modal__title">
          Selezione Personaggio
        </h2>

        <p className="character-select-modal__subtitle">
          Benvenuto, {username}
        </p>

        {error && (
          <Alert type="error" message={error} dismissible onDismiss={() => setError('')} />
        )}

        {characters && characters.length > 0 ? (
          <>
            <h3 className="character-select-modal__section-title">
              I tuoi personaggi:
            </h3>
            <div className="character-select-modal__list">
              {characters.map((character: any) => {
                const gameUrl = process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:3010';
                const avatarUrl = character.avatar || `${gameUrl}/images/sidebar/miniavatar_default.png`;
                const status = character.playerStatus?.toLowerCase() || 'draft';

                return (
                  <Card key={character.id}>
                    <div className="character-select-modal__character">
                      {/* Avatar */}
                      <img
                        src={avatarUrl}
                        alt={character.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `${gameUrl}/images/sidebar/miniavatar_default.png`;
                        }}
                        className="character-select-modal__avatar"
                      />

                      {/* Info */}
                      <div className="character-select-modal__info">
                        <div className="character-select-modal__name-row">
                          <h4 className="character-select-modal__name">
                            {character.name}
                          </h4>
                          {getCharacterTypeBadge(character)}
                        </div>
                        <p className={`character-select-modal__status character-select-modal__status--${status}`}>
                          {CHARACTER_STATUS_TEXT[status] || status}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="character-select-modal__action">
                        {canSelectCharacter(character) ? (
                          <Button
                            type="button"
                            variant="primary"
                            loading={selecting === character.id}
                            onClick={() => handleSelectCharacter(character.id)}
                            className="character-select-modal__select-button"
                          >
                            Seleziona
                          </Button>
                        ) : (
                          <span className="character-select-modal__unavailable">
                            Non disponibile
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <div className="character-select-modal__empty">
            <p>Non hai ancora nessun personaggio.</p>
          </div>
        )}

        {/* Actions */}
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
