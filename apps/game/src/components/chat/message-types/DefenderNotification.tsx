/**
 * Defender Notification Component
 *
 * Shows notification when defender detects deception (failed Raggirare).
 * Only visible to defender and master.
 *
 * @module components/chat/message-types/DefenderNotification
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface DefenderNotificationProps {
  message: ChatMessage;
  formattedTime: string;
}

export function DefenderNotification({ message, formattedTime }: DefenderNotificationProps): JSX.Element {
  const skillCheck = message.skillCheck as any; // TODO: Update type after Phase 6

  return (
    <div className={styles.defenderNotification}>
      <div className={styles.notificationHeader}>
        <span className={styles.warningIcon}>⚠️</span>
        <strong>You sense something's wrong</strong>
        <time className={styles.messageTimestamp} dateTime={message.createdAt}>
          {formattedTime}
        </time>
      </div>

      <div className={styles.notificationContent}>
        <p className={styles.notificationText}>
          You notice <strong>{message.characterName}</strong> is being deceptive.
        </p>

        {skillCheck && skillCheck.attackSkill && skillCheck.defenseSkill && (
          <p className={styles.notificationDetails}>
            Your <strong>{skillCheck.defenseSkill}</strong> ({skillCheck.defenseDegree})
            detected their <strong>{skillCheck.attackSkill}</strong> ({skillCheck.attackDegree}).
          </p>
        )}

        {/* Show visible action text (what they said) */}
        {message.text && (
          <div className={styles.suspiciousAction}>
            <span className={styles.label}>What they said:</span>
            <p>"{message.text}"</p>
          </div>
        )}

        <div className={styles.notificationFooter}>
          💡 You don't know what they're hiding, but something feels off.
        </div>
      </div>
    </div>
  );
}
