/**
 * Message Avatar
 *
 * Renders the clickable avatar button used by every chat message type.
 * Falls back to the app-wide default avatar both when the character has no
 * avatar set and when the configured avatar URL fails to load.
 *
 * @module components/chat/MessageAvatar
 */

'use client';

import { useEffect, useState } from 'react';

import { useCharacterSheetData } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/chat/MessageCard.module.scss';

const DEFAULT_AVATAR = '/images/sidebar/miniavatar_default.png';

interface MessageAvatarProps {
  avatar?: string;
  characterName?: string;
  onClick: () => void;
  isMasked?: boolean;
  /** Needed to lazy-fetch hover data. Omit (or leave masked) to disable the hover card entirely. */
  characterId?: string;
}

export function MessageAvatar({
  avatar,
  characterName,
  onClick,
  isMasked = false,
  characterId,
}: MessageAvatarProps): JSX.Element {
  const [src, setSrc] = useState(avatar || DEFAULT_AVATAR);
  const [hasHovered, setHasHovered] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Reset when the character's avatar actually changes (e.g. row reused for a different message)
  useEffect(() => {
    setSrc(avatar || DEFAULT_AVATAR);
  }, [avatar]);

  // Never fetch/show hover data for a masked identity — that would defeat the mask.
  const hoverEnabled = !isMasked && !!characterId;

  // Lazy: the hook fetches only once `characterId` is non-empty, so passing '' until the
  // first hover keeps every avatar in the chat from eagerly fetching on mount.
  const { data } = useCharacterSheetData(hoverEnabled && hasHovered ? characterId! : '');
  const character = data?.character;

  // Fields present in `character` are already permission-filtered server-side
  // (hiddenMarks/currentHP/maxHP are stripped for non-owner, non-master viewers) —
  // render whatever comes back, don't re-check permissions client-side.
  const hasHoverContent = !!(character?.visibleMarks || character?.hiddenMarks || character?.currentHP != null);

  return (
    <div
      className={styles.messageAvatarWrapper}
      onMouseEnter={() => {
        setIsHovering(true);
        setHasHovered(true);
      }}
      onMouseLeave={() => setIsHovering(false)}
    >
      <button
        className={`${styles.messageAvatar} ${isMasked ? styles.avatarDisabled : ''}`}
        onClick={onClick}
        type="button"
        aria-label={isMasked ? 'Identità nascosta' : `Apri scheda di ${characterName}`}
        disabled={isMasked}
        title={isMasked ? 'Identità nascosta (PNG Light)' : undefined}
      >
        <img
          src={src}
          alt=""
          onError={() => {
            if (src !== DEFAULT_AVATAR) {
              setSrc(DEFAULT_AVATAR);
            }
          }}
        />
      </button>

      {isHovering && hoverEnabled && hasHoverContent && (
        <div className={styles.messageAvatarHoverCard} role="tooltip">
          {character?.visibleMarks && (
            <p className={styles.messageAvatarHoverLine}>{character.visibleMarks}</p>
          )}
          {character?.hiddenMarks && (
            <p className={`${styles.messageAvatarHoverLine} ${styles.messageAvatarHoverMaster}`}>
              {character.hiddenMarks}
            </p>
          )}
          {character?.currentHP != null && (
            <p className={`${styles.messageAvatarHoverLine} ${styles.messageAvatarHoverMaster}`}>
              PF: {character.currentHP}
              {character?.maxHP != null ? ` / ${character.maxHP}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
