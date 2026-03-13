/**
 * Whisper Message Component
 *
 * Private message visible only to sender, target, and masters.
 * Shows "whispers to [target]" prefix.
 *
 * @module components/chat/message-types/WhisperMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface WhisperMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function WhisperMessage({ message, formattedTime }: WhisperMessageProps): JSX.Element {
  // Extract target from targetCharacters (DB field)
  const targetName = message.targetCharacters && message.targetCharacters.length > 0
    ? '(privato)' // TODO: Fetch target character name if needed
    : '(privato)';

  return (
    <>
      {/* Header: Character name, whisper indicator, timestamp */}
      <div className={styles.messageHeader}>
        <span className={styles.characterName}>{message.characterName}</span>
        <span className={styles.whisperIndicator}>sussurra {targetName}</span>

        {message.position && (
          <span className={styles.characterTag}>@ {message.position}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.timestamp}>
          {formattedTime}
        </time>
      </div>

      {/* Content: Message text (italic for whispers) */}
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
