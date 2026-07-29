/**
 * MessageFooter
 *
 * Displays clickable position and edited indicator.
 * Position click sets currentPosition in chat form.
 */

import styles from '@/styles/components/chat/MessageFooter.module.scss';
import { ChatMessage } from '@/types/chat';

interface MessageFooterProps {
  message: ChatMessage;
  onPositionClick: (position: string) => void;
}

export function MessageFooter({ message, onPositionClick }: MessageFooterProps) {
  const hasBeenEdited = (message.editHistory?.length ?? 0) > 0;

  if (!message.position && !hasBeenEdited) {
    return null;
  }

  return (
    <div className={styles.messageFooter}>
      {message.position && (
        <button
          className={styles.characterPosition}
          onClick={() => onPositionClick(message.position!)}
          type="button"
          aria-label={`Imposta posizione: ${message.position}`}
        >
          @ {message.position}
        </button>
      )}

      {hasBeenEdited && (
        <span className={styles.messageEdited}>modificato</span>
      )}
    </div>
  );
}
