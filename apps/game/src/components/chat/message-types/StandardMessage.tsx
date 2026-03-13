/**
 * Standard Message Component
 *
 * Default message type for in-character actions and dialogue.
 *
 * @module components/chat/message-types/StandardMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface StandardMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function StandardMessage({ message, formattedTime }: StandardMessageProps): JSX.Element {
  return (
    <>
      {/* Header: Character name, tag, timestamp */}
      <div className={styles.messageHeader}>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.position && (
          <span className={styles.characterTag}>@ {message.position}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.timestamp}>
          {formattedTime}
        </time>
      </div>

      {/* Content: Message text */}
      <div className={styles.messageContent}>{message.content}</div>

      {/* Edited indicator */}
      {(message.editHistory?.length ?? 0) > 0 && message.editHistory?.[0]?.editedAt && (
        <div className={styles.messageEdited}>
          modificato alle {formattedTime}
        </div>
      )}
    </>
  );
}
