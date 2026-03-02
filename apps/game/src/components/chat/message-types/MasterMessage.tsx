/**
 * Master Message Component
 *
 * Special announcement from game master.
 * Highlighted with gold border and bold text.
 *
 * @module components/chat/message-types/MasterMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface MasterMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function MasterMessage({ message, formattedTime }: MasterMessageProps): JSX.Element {
  return (
    <>
      {/* Header: Master prefix + character name */}
      <div className={styles.messageHeader}>
        <span className={styles.masterPrefix}>★ MASTER</span>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.characterTag && (
          <span className={styles.characterTag}>@ {message.characterTag}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.createdAt}>
          {formattedTime}
        </time>
      </div>

      {/* Content: Message text (bold) */}
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
