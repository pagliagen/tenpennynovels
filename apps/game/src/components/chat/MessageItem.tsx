/**
 * Message Item Component
 *
 * Renders a single chat message using type-specific components.
 * Routes to appropriate component based on messageType.
 *
 * @module components/chat/MessageItem
 * @since 2.0.0
 */

'use client';

import { useMemo } from 'react';
import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

// Import type-specific components
import { StandardMessage } from './message-types/StandardMessage';
import { WhisperMessage } from './message-types/WhisperMessage';
import { OOCMessage } from './message-types/OOCMessage';
import { MasterMessage } from './message-types/MasterMessage';
import { DiceRollMessage } from './message-types/DiceRollMessage';
import { SkillCheckMessage } from './message-types/SkillCheckMessage';
import { StatCheckMessage } from './message-types/StatCheckMessage';
import { ItemUseMessage } from './message-types/ItemUseMessage';
import { ModerationMessage } from './message-types/ModerationMessage';
import { DefenderNotification } from './message-types/DefenderNotification';

/**
 * Message Item Props
 */
interface MessageItemProps {
  /** Message to display */
  message: ChatMessage;

  /** Whether message should be dimmed (tag-based visibility) */
  isDimmed?: boolean;
}

/**
 * Format timestamp to readable format
 *
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time (HH:MM)
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Message Item Component
 *
 * Container that routes to type-specific message components.
 *
 * @param {MessageItemProps} props - Component props
 * @returns {JSX.Element} Message item
 */
export function MessageItem({ message, isDimmed = false }: MessageItemProps): JSX.Element {
  // Format timestamp
  const formattedTime = useMemo(() => formatTimestamp(message.createdAt), [message.createdAt]);

  // CSS classes based on message type
  const messageClasses = [styles.messageItem];

  // Add dimmed class if message should be less visible
  if (isDimmed) {
    messageClasses.push(styles.messageItemDimmed);
  }

  // Add type-specific class (e.g., messageItem--standard, messageItem--whisper)
  const typeClass = `messageItem--${message.messageType}`;
  if (styles[typeClass]) {
    messageClasses.push(styles[typeClass]);
  }

  // Legacy: Keep backward compatibility with old class names
  if (message.messageType === 'ooc' && styles.messageItemOOC) {
    messageClasses.push(styles.messageItemOOC);
  } else if (message.messageType === 'whisper' && styles.messageItemWhisper) {
    messageClasses.push(styles.messageItemWhisper);
  } else if (message.messageType === 'master' && styles.messageItemMaster) {
    messageClasses.push(styles.messageItemMaster);
  }

  // Render type-specific component
  let content: JSX.Element;

  switch (message.messageType) {
    case 'whisper':
      content = <WhisperMessage message={message} formattedTime={formattedTime} />;
      break;

    case 'ooc':
      content = <OOCMessage message={message} formattedTime={formattedTime} />;
      break;

    case 'master':
      content = <MasterMessage message={message} formattedTime={formattedTime} />;
      break;

    case 'dice_roll':
      content = <DiceRollMessage message={message} formattedTime={formattedTime} />;
      break;

    case 'skill_check':
      // Route to DefenderNotification if this is a defender-only notification (Raggirare failure)
      if ((message as any).visibleToDefenderOnly) {
        content = <DefenderNotification message={message} formattedTime={formattedTime} />;
      } else {
        content = <SkillCheckMessage message={message} formattedTime={formattedTime} />;
      }
      break;

    case 'stat_check':
      content = <StatCheckMessage message={message} formattedTime={formattedTime} />;
      break;

    case 'item_use':
      content = <ItemUseMessage message={message} formattedTime={formattedTime} />;
      break;

    case 'moderation':
      content = <ModerationMessage message={message} formattedTime={formattedTime} />;
      break;

    case 'standard':
    default:
      content = <StandardMessage message={message} formattedTime={formattedTime} />;
      break;
  }

  return (
    <div
      className={messageClasses.join(' ')}
      data-message-id={message._id}
      data-message-type={message.messageType}
    >
      {content}
    </div>
  );
}
