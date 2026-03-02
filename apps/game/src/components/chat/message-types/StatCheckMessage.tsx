/**
 * Stat Check Message Component
 *
 * Shows attribute check result (Strength, Dexterity, etc.).
 * TODO: Customize with attribute details, difficulty, roll result.
 *
 * @module components/chat/message-types/StatCheckMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface StatCheckMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function StatCheckMessage({ message, formattedTime }: StatCheckMessageProps): JSX.Element {
  const statCheck = message.statCheck;

  return (
    <>
      <div className={styles.messageHeader}>
        <span className={styles.statIcon}>💪</span>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.characterTag && (
          <span className={styles.characterTag}>@ {message.characterTag}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.createdAt}>
          {formattedTime}
        </time>
      </div>

      <div className={styles.messageContent}>{message.text}</div>

      {/* TODO: Render stat check details */}
      {statCheck && (
        <div className={styles.statCheckResult}>
          {statCheck.attribute} ({statCheck.difficulty}) | Roll: {statCheck.roll} vs {statCheck.target} | {statCheck.success ? '✅' : '❌'}
        </div>
      )}
    </>
  );
}
