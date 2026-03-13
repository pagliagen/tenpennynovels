/**
 * Item Use Message Component
 *
 * Shows item usage action with item details and effects.
 * TODO: Customize with item icon, effects visualization.
 *
 * @module components/chat/message-types/ItemUseMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface ItemUseMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function ItemUseMessage({ message, formattedTime }: ItemUseMessageProps): JSX.Element {
  const itemUse = message.itemEffect;

  return (
    <>
      <div className={styles.messageHeader}>
        <span className={styles.itemIcon}>📦</span>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.position && (
          <span className={styles.characterTag}>@ {message.position}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.timestamp}>
          {formattedTime}
        </time>
      </div>

      <div className={styles.messageContent}>{message.content}</div>

      {/* TODO: Render item use details */}
      {itemUse && (
        <div className={styles.itemUseDetails}>
          <strong>{itemUse.itemName}</strong>
          {itemUse.itemDescription && <p>{itemUse.itemDescription}</p>}
          {itemUse.targetCharacterName && (
            <span>→ {itemUse.targetCharacterName}</span>
          )}
        </div>
      )}
    </>
  );
}
