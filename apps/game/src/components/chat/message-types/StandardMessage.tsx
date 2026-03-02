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

        {message.characterTag && (
          <span className={styles.characterTag}>@ {message.characterTag}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.createdAt}>
          {formattedTime}
        </time>
      </div>

      {/* Content: Message text */}
      <div className={styles.messageContent}>{message.text}</div>

      {/* Edited indicator */}
      {message.isEdited && message.editedAt && (
        <div className={styles.messageEdited}>
          modificato alle {formattedTime}
        </div>
      )}
    </>
  );
}
