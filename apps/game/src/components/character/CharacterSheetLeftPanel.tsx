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

import styles from '@/styles/components/character/CharacterSheetContent.module.scss';
import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import { useAuthStore } from '@/store/authStore';

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

  // IN-GAME messages only available for APPROVED characters (and not to yourself)
  const canSendInGameMessage = character.status === 'APPROVED' && !isOwnCharacter;

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
            style={{
              opacity: canSendInGameMessage ? 1 : 0.5,
              cursor: canSendInGameMessage ? 'pointer' : 'not-allowed'
            }}
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
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff9500', fontSize: '1.125rem' }}>
          {character.name}
        </h3>
        {character.occupation && (
          <p style={{ margin: '0 0 0.5rem 0', color: '#e8e0d5', fontSize: '0.9375rem' }}>
            {character.occupation.name}
          </p>
        )}
        <p style={{ margin: '0', color: '#999', fontSize: '0.8125rem' }}>
          Status: <span style={{ color: getStatusColor(character.status) }}>{character.status}</span>
        </p>
        {permissions.isOwner && (
          <p style={{ margin: '0.5rem 0 0 0', color: '#ff9500', fontSize: '0.8125rem', fontWeight: 600 }}>
            👤 Tuo Personaggio
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Get color for character status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'APPROVED':
      return '#4ade80'; // Green
    case 'PENDING_APPROVAL':
      return '#fbbf24'; // Yellow
    case 'DRAFT':
      return '#94a3b8'; // Gray
    case 'REJECTED':
      return '#ef4444'; // Red
    default:
      return '#999';
  }
}
