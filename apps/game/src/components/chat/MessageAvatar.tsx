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

import styles from '@/styles/components/chat/MessageCard.module.scss';

const DEFAULT_AVATAR = '/images/sidebar/miniavatar_default.png';

interface MessageAvatarProps {
  avatar?: string;
  characterName?: string;
  onClick: () => void;
  isMasked?: boolean;
}

export function MessageAvatar({
  avatar,
  characterName,
  onClick,
  isMasked = false,
}: MessageAvatarProps): JSX.Element {
  const [src, setSrc] = useState(avatar || DEFAULT_AVATAR);

  // Reset when the character's avatar actually changes (e.g. row reused for a different message)
  useEffect(() => {
    setSrc(avatar || DEFAULT_AVATAR);
  }, [avatar]);

  return (
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
  );
}
