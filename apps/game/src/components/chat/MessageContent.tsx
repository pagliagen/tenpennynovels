/**
 * Message Content
 *
 * Renders parsed chat message content: dialogue spans (`<...>`) and character
 * mentions (`@Nome`). A mention is only rendered as a clickable button when
 * the named character is currently present in the location (chatStore
 * occupants); otherwise it renders as styled, non-interactive text. In both
 * cases the leading `@` is stripped - it is pure input syntax, not part of
 * the displayed name.
 *
 * @module components/chat/MessageContent
 */

'use client';

import { useMemo } from 'react';

import { tokenizeMessageContent } from '@/lib/utils/messageContentParser';
import { useChatOccupants } from '@/store/chatStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';

import styles from '@/styles/components/chat/MessageContent.module.scss';

interface MessageContentProps {
  content: string;
  /** Visual variant for the resolved-mention token. Defaults to the standard/whisper look. */
  mentionVariant?: 'default' | 'master';
}

export function MessageContent({ content, mentionVariant = 'default' }: MessageContentProps): JSX.Element {
  const occupants = useChatOccupants();
  const openWindow = useWindowManagerStore((state) => state.openWindow);

  // Character.name has a unique index backend-side (= username), so matching
  // on the first token of characterName can't collide between occupants.
  const occupantsByFirstName = useMemo(() => {
    const map = new Map<string, { characterId: string; characterName: string }>();
    for (const occupant of occupants) {
      const firstName = occupant.characterName.split(' ')[0]?.toLowerCase();
      if (firstName) {
        map.set(firstName, occupant);
      }
    }
    return map;
  }, [occupants]);

  const tokens = useMemo(() => tokenizeMessageContent(content), [content]);

  return (
    <>
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'dialogue':
            return (
              <span key={index} className={styles.dialogue}>
                {token.value}
              </span>
            );

          case 'mention': {
            const occupant = occupantsByFirstName.get(token.name.toLowerCase());

            if (!occupant) {
              return (
                <span key={index} className={styles.mentionUnresolved}>
                  {token.name}
                </span>
              );
            }

            const mentionClassName =
              mentionVariant === 'master'
                ? `${styles.mention} ${styles.mentionMaster}`
                : styles.mention;

            return (
              <button
                key={index}
                type="button"
                className={mentionClassName}
                onClick={() =>
                  openWindow('characterSheet', {
                    characterId: occupant.characterId,
                    characterName: occupant.characterName,
                    avatar: undefined,
                  })
                }
              >
                {token.name}
              </button>
            );
          }

          case 'text':
          default:
            return <span key={index}>{token.value}</span>;
        }
      })}
    </>
  );
}
