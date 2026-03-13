/**
 * MessageFooter
 *
 * Displays clickable tag/position and edited indicator.
 * Tag click sets currentTag in chat form.
 */

import { ChatMessage } from '@/types/chat';
import styles from '@/styles/components/chat/MessageFooter.module.scss';

interface MessageFooterProps {
  message: ChatMessage;
  onTagClick: (tag: string) => void;
}

export function MessageFooter({ message, onTagClick }: MessageFooterProps) {
  const hasBeenEdited = (message.editHistory?.length ?? 0) > 0;

  if (!message.position && !hasBeenEdited) {
    return null;
  }

  return (
    <div className={styles.messageFooter}>
      {message.position && (
        <button
          className={styles.characterTag}
          onClick={() => onTagClick(message.position!)}
          type="button"
          aria-label={`Imposta tag: ${message.position}`}
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
