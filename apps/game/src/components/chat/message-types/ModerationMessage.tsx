/**
 * Moderation Message Component
 *
 * System or moderator message (warnings, bans, etc.).
 * Displayed with red/warning colors.
 *
 * @module components/chat/message-types/ModerationMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface ModerationMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function ModerationMessage({ message, formattedTime }: ModerationMessageProps): JSX.Element {
  return (
    <>
      <div className={styles.messageHeader}>
        <span className={styles.moderationIcon}>⚠️</span>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.position && (
          <span className={styles.characterTag}>@ {message.position}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.timestamp}>
          {formattedTime}
        </time>
      </div>

      <div className={styles.messageContent}>{message.content}</div>
    </>
  );
}
