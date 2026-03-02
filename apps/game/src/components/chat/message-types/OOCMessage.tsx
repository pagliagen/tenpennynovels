/**
 * OOC Message Component
 *
 * Out-of-character message for meta-game discussion.
 * Displayed in italic with muted colors.
 *
 * @module components/chat/message-types/OOCMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface OOCMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function OOCMessage({ message, formattedTime }: OOCMessageProps): JSX.Element {
  return (
    <>
      {/* Header: Character name with OOC prefix */}
      <div className={styles.messageHeader}>
        <span className={styles.oocPrefix}>[OOC]</span>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.characterTag && (
          <span className={styles.characterTag}>@ {message.characterTag}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.createdAt}>
          {formattedTime}
        </time>
      </div>

      {/* Content: Message text (italic) */}
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
