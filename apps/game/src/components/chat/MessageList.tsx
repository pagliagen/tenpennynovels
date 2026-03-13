/**
 * Message List Component
 *
 * Scrollable container for chat messages.
 * Implements smart auto-scroll (NO auto-scroll when reading old messages).
 *
 * @module components/chat/MessageList
 * @since 2.0.0
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '@/styles/components/chat/MessageList.module.scss';
import { MessageItem } from './MessageItem';
import type { ChatMessage } from '@/types/chat';

/**
 * Message List Props
 */
interface MessageListProps {
  /** Messages to display */
  messages: ChatMessage[];

  /** Loading state */
  isLoading?: boolean;

  /** Current character ID (for tag-based visibility) */
  currentCharacterId?: string;

  /** Is current character a master (for visibility rules) */
  isMaster?: boolean;
}

/**
 * Check if message is visible to current character based on message type
 *
 * Visibility rules by type:
 * - standard: all (subject to tag dimming)
 * - ooc: all (NO dimming)
 * - whisper: only sender + target + master (NO dimming)
 * - master: all (NO dimming)
 * - moderation: all (NO dimming)
 * - dice_roll: all (subject to tag dimming)
 * - skill_check: only sender + master (NO dimming)
 * - stat_check: only sender + master (NO dimming)
 * - item_use: all (subject to tag dimming)
 *
 * @param {ChatMessage} message - Message to check
 * @param {string} currentCharacterId - Current character ID
 * @param {boolean} isMaster - Is current character a master
 * @returns {boolean} True if message should be visible
 */
function isMessageVisible(
  message: ChatMessage,
  currentCharacterId: string,
  isMaster: boolean
): boolean {
  switch (message.actionType) {
    case 'whisper':
      // Only sender + target + master can see whispers
      return (
        message.characterId === currentCharacterId ||
        message.targetCharacters?.includes(currentCharacterId) ||
        isMaster
      );

    case 'skill_check':
    case 'stat_check':
      // Only sender + master can see skill/stat checks
      return message.characterId === currentCharacterId || isMaster;

    default:
      // All other types visible to everyone
      return true;
  }
}

/**
 * Calculate if a message should be dimmed based on tag visibility logic
 *
 * Logic:
 * - Some types are NEVER dimmed (ooc, whisper, master, moderation, skill_check, stat_check)
 * - For dimmable types (standard, dice_roll, item_use):
 *   - Find the most recent action by currentCharacter BEFORE this message
 *   - If no previous action → show normally (start of chat)
 *   - If message is by currentCharacter → show normally (own message)
 *   - If message tag matches lastMyAction tag → show normally
 *   - Otherwise → dim (different tag context)
 *
 * @param {ChatMessage} message - Message to check
 * @param {ChatMessage[]} allMessages - All messages in chronological order
 * @param {string} currentCharacterId - Current character ID
 * @returns {boolean} True if message should be dimmed
 */
function shouldDimMessage(
  message: ChatMessage,
  allMessages: ChatMessage[],
  currentCharacterId: string
): boolean {
  // These types are NEVER dimmed (always full visibility)
  const neverDim: string[] = [
    'ooc',
    'whisper',
    'master',
    'moderation',
    'skill_check',
    'stat_check',
  ];

  if (neverDim.includes(message.actionType)) {
    return false;
  }

  // Always show own messages normally
  if (message.characterId === currentCharacterId) {
    return false;
  }

  // Find index of current message
  const messageIndex = allMessages.findIndex((m) => m._id === message._id);
  if (messageIndex === -1) return false;

  // Find most recent action by current character BEFORE this message
  let lastMyAction: ChatMessage | null = null;
  for (let i = messageIndex - 1; i >= 0; i--) {
    if (allMessages[i]?.characterId === currentCharacterId) {
      lastMyAction = allMessages[i]!;
      break;
    }
  }

  // No previous action by current character → show normally (start of chat)
  if (!lastMyAction) {
    return false;
  }

  // Compare positions: if same position as last my action → show normally
  const lastMyPosition = lastMyAction.position || '';
  const messagePosition = message.position || '';

  // Different position → dim
  return lastMyPosition !== messagePosition;
}

/**
 * Message List Component
 *
 * Renders scrollable list of messages with smart auto-scroll.
 *
 * **Smart Auto-Scroll Logic**:
 * - If user scrolled up (reading old messages) → NEW message arrives → NO auto-scroll (don't lose context)
 * - If user at bottom (< 150px from bottom) → NEW message arrives → auto-scroll (following conversation)
 *
 * **Tag-Based Visibility**:
 * - Messages with same tag as your last action → normal visibility
 * - Messages with different tag → dimmed (reduces visual noise)
 *
 * @param {MessageListProps} props - Component props
 * @returns {JSX.Element} Message list
 */
export function MessageList({ messages, isLoading, currentCharacterId, isMaster = false }: MessageListProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Track if user is near bottom (for smart auto-scroll)
  const [isNearBottom, setIsNearBottom] = useState(true);

  /**
   * Check if scroll position is near bottom
   */
  const checkIfNearBottom = () => {
    if (!listRef.current) return false;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const threshold = 150; // pixels from bottom
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    return distanceFromBottom < threshold;
  };

  /**
   * Scroll to bottom (smooth)
   */
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (!listRef.current) return;

    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior,
    });
  };

  /**
   * Handle scroll event (update isNearBottom state)
   */
  const handleScroll = () => {
    setIsNearBottom(checkIfNearBottom());
  };

  /**
   * Smart Auto-Scroll on new messages
   *
   * Only auto-scroll if user was already near bottom (following conversation).
   * If user scrolled up, do NOT auto-scroll (let them read old messages).
   */
  useEffect(() => {
    const messageCount = messages.length;
    const prevMessageCount = prevMessageCountRef.current;

    // Check if new message added
    if (messageCount > prevMessageCount) {
      // New message arrived
      if (isNearBottom) {
        // User was near bottom → auto-scroll
        scrollToBottom('smooth');
      } else {
        // User scrolled up → do NOT auto-scroll (would lose reading position)
        console.log('📜 New message arrived, but user scrolled up - not auto-scrolling');
      }
    }

    // Update prev count
    prevMessageCountRef.current = messageCount;
  }, [messages.length, isNearBottom]);

  /**
   * Initial scroll to bottom on first load
   */
  useEffect(() => {
    if (messages.length > 0 && listRef.current) {
      // Use instant scroll for initial load (no animation)
      scrollToBottom('instant');
    }
  }, []); // Only on mount

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.messageList}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} role="status" aria-label="Loading messages" />
          <p>Caricamento messaggi...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div className={styles.messageList}>
        <div className={styles.messageListEmpty}>
          <p>Nessun messaggio nella chat.</p>
          <p>Inizia la conversazione!</p>
        </div>
      </div>
    );
  }

  // Message list
  return (
    <div
      ref={listRef}
      className={styles.messageList}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages
        .filter((message) => {
          // Filter out messages not visible to current character
          if (!currentCharacterId) return true; // Show all if no character context
          return isMessageVisible(message, currentCharacterId, isMaster);
        })
        .map((message) => {
          // Calculate if message should be dimmed based on tag visibility
          const isDimmed =
            currentCharacterId
              ? shouldDimMessage(message, messages, currentCharacterId)
              : false;

          return <MessageItem key={message._id} message={message} isDimmed={isDimmed} />;
        })}
    </div>
  );
}
