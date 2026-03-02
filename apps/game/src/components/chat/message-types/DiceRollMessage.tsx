/**
 * Dice Roll Message Component
 *
 * Shows dice roll with notation, individual rolls, and total result.
 * Example: "2d6+3 → [4, 5] + 3 = 12"
 *
 * @module components/chat/message-types/DiceRollMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface DiceRollMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function DiceRollMessage({ message, formattedTime }: DiceRollMessageProps): JSX.Element {
  const diceRoll = message.diceRoll;

  return (
    <>
      {/* Header: Character name + dice icon */}
      <div className={styles.messageHeader}>
        <span className={styles.diceIcon}>🎲</span>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.characterTag && (
          <span className={styles.characterTag}>@ {message.characterTag}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.createdAt}>
          {formattedTime}
        </time>
      </div>

      {/* Content: Action description */}
      {message.text && <div className={styles.messageContent}>{message.text}</div>}

      {/* Dice roll result: Sistema percentuale 1d100 */}
      {diceRoll && (
        <div className={styles.diceRollResult}>
          <span className={styles.diceTotal}>{diceRoll.result}/100</span>
        </div>
      )}

      {/* Edited indicator */}
      {message.isEdited && message.editedAt && (
        <div className={styles.messageEdited}>
          modificato alle {formattedTime}
        </div>
      )}
    </>
  );
}
