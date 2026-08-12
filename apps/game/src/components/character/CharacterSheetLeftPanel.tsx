/**
 * Character Sheet Left Panel Component
 *
 * Left side of character sheet window.
 * Displays portrait (280×350px) and action buttons (IN-GAME, OFF-GAME).
 *
 * @module components/character/CharacterSheetLeftPanel
 * @since 2.0.0
 */

'use client';

import type { CSSProperties } from 'react';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import { useAuthStore } from '@/store/authStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';

/**
 * Character Sheet Left Panel Props
 *
 * @interface CharacterSheetLeftPanelProps
 * @since 2.0.0
 */
interface CharacterSheetLeftPanelProps {
  /** Character data from React Query */
  character: CharacterSheetData['character'];

  /** Permissions for this viewer */
  permissions: CharacterSheetPermissions;
}

/**
 * Character Sheet Left Panel Component
 *
 * Portrait + action buttons.
 *
 * @component
 * @param {CharacterSheetLeftPanelProps} props - Component props
 * @returns {JSX.Element} Left panel
 * @since 2.0.0
 */
export function CharacterSheetLeftPanel({
  character,
  permissions,
}: CharacterSheetLeftPanelProps): JSX.Element {
  // Window manager for opening mail windows
  const { openWindow } = useWindowManagerStore();

  // Auth store to check if viewing own character
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);
  const isOwnCharacter = selectedCharacter?._id === character._id;

  /**
   * Handle IN-GAME message button click
   * Opens mail window in compose view with recipient pre-filled
   */
  const handleInGameMessage = () => {
    openWindow('messageOnGame', {
      conversationId: 'inbox',
      conversationTitle: `Messaggio a ${character.name}`,
      initialView: 'compose',
      prefilledRecipientId: character._id,
      prefilledRecipientName: character.name,
    });
  };

  /**
   * Handle OFF-GAME message button click
   * Opens OffGame chat window in new chat view with recipient pre-filled
   */
  const handleOffGameMessage = () => {
    openWindow('messageOffGame', {
      conversationId: 'offgame-main',
      conversationTitle: `Messaggio OFF-GAME a ${character.name}`,
      initialView: 'new',
      prefilledRecipientId: character._id,
      prefilledRecipientName: character.name,
    });
  };

  // Determine portrait image (prioritize profileImage, fallback to avatar)
  const portraitSrc = character.profileImage || character.avatar || '/images/sidebar/miniavatar_default.png';

  // IN-GAME messages only available for approved characters (and not to yourself)
  // Check if target character is approved (playerStatus from backend is lowercase)
  const canSendInGameMessage = character.playerStatus === 'approved' && !isOwnCharacter;

  return (
    <div className={styles.leftPanel}>
      {/* Portrait */}
      <div className={styles.portrait}>
        <img
          src={portraitSrc}
          alt={`${character.name} Portrait`}
          className={styles.portraitImage}
        />
      </div>

      {/* Action Buttons - Hidden when viewing own character */}
      {!isOwnCharacter && (
        <div className={styles.actionButtons}>
          <button
            className={styles.actionBtn}
            onClick={handleInGameMessage}
            disabled={!canSendInGameMessage}
            title={canSendInGameMessage ? 'Invia messaggio in-character' : 'Solo personaggi approvati possono inviare messaggi IN-GAME'}
          >
            <span className={styles.btnIcon}>💬</span>
            <span className={styles.btnText}>Messaggio IN-GAME</span>
          </button>

          <button className={styles.actionBtn} onClick={handleOffGameMessage}>
            <span className={styles.btnIcon}>📧</span>
            <span className={styles.btnText}>Messaggio OFF-GAME</span>
          </button>
        </div>
      )}

      {/* Character Info Preview */}
      <div className={styles.infoPreview}>
        <h3 className={styles.infoName}>
          {character.firstName}{character.surname ? ` ${character.surname}` : ''}
        </h3>
        {character.occupation && (
          <p className={styles.infoOccupation}>
            {character.occupation.name}
          </p>
        )}
        <p className={styles.statusLine}>
          Status:{' '}
          <span
            className={styles.statusValue}
            style={
              { '--character-status-color': getStatusColor(character.playerStatus) } as CSSProperties
            }
          >
            {getStatusDisplay(character.playerStatus)}
          </span>
        </p>
        {permissions.isOwner && (
          <p className={styles.ownerNote}>
            👤 Tuo Personaggio
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Get display name for playerStatus
 */
function getStatusDisplay(playerStatus?: string): string {
  switch (playerStatus) {
    case 'approved':
      return 'Approvato';
    case 'pending':
      return 'In Attesa';
    case 'draft':
      return 'Bozza';
    default:
      return 'Sconosciuto';
  }
}

/**
 * Get color for character playerStatus
 */
function getStatusColor(playerStatus?: string): string {
  switch (playerStatus) {
    case 'approved':
      return '#4ade80'; // Green
    case 'pending':
      return '#fbbf24'; // Yellow
    case 'draft':
      return '#94a3b8'; // Gray
    default:
      return '#999';
  }
}
