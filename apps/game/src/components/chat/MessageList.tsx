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

import { useChatCurrentTag } from '@/store/chatStore';
import styles from '@/styles/components/chat/MessageList.module.scss';
import type { ChatMessage } from '@/types/chat';

import { MessageItem } from './MessageItem';
import { logger } from '@/lib/logger';

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
 * Check if message is visible to current character.
 *
 * Source of truth is `message.visibility` (mirrors backend
 * ChatMessageService.canSeeAction), NOT `message.actionType` — several action
 * types (e.g. confrontation_reaction_request) carry `visibility: 'whisper'`
 * while having a different actionType, and would otherwise slip through.
 *
 * Visibility rules:
 * - 'whisper': only sender + targetCharacters + master
 * - 'master_only': master, plus targetCharacters if the master targeted an
 *   "esito riservato" to specific characters (covers actionType 'master' and
 *   'moderation' — moderation is always untargeted, so this is a no-op there)
 * - 'public' / undefined: everyone, EXCEPT:
 *   - stat_check / skill_check: only sender + master (regardless of visibility flag)
 *   - socialConflict.visibleToDefenderOnly: only the defender + master
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
  if (isMaster) return true;

  if (message.visibility === 'whisper') {
    return (
      message.characterId === currentCharacterId ||
      !!message.targetCharacters?.includes(currentCharacterId)
    );
  }

  if (message.visibility === 'master_only') {
    // Not master (already returned above) — visible only if explicitly targeted.
    return !!message.targetCharacters?.includes(currentCharacterId);
  }

  // Sender-only checks, independent of the visibility flag
  if (message.actionType === 'stat_check' || message.actionType === 'skill_check') {
    return message.characterId === currentCharacterId;
  }

  const socialConflict = (message as unknown as { socialConflict?: { visibleToDefenderOnly?: boolean } }).socialConflict;
  if (socialConflict?.visibleToDefenderOnly) {
    return !!message.targetCharacters?.includes(currentCharacterId);
  }

  // Public (or unspecified, for older/legacy records): visible to everyone
  return true;
}

/**
 * Calculate if a message should be dimmed based on current tag
 *
 * Logic:
 * - If no current tag selected → show all normally
 * - If message.position !== currentTag → dim
 * - Applies to ALL message types without exception
 *
 * @param {ChatMessage} message - Message to check
 * @param {string | null} currentTag - Current active tag from chatStore
 * @returns {boolean} True if message should be dimmed
 */
function shouldDimMessage(
  message: ChatMessage,
  currentTag: string | null
): boolean {
  // No current tag selected → show all normally
  if (!currentTag) {
    return false;
  }

  // Dim if message tag doesn't match current tag
  return message.position !== currentTag;
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
 * - Messages with tag matching currentTag → normal visibility
 * - Messages with different tag → dimmed (opacity 0.4)
 * - Applies to ALL message types without exception
 *
 * @param {MessageListProps} props - Component props
 * @returns {JSX.Element} Message list
 */
export function MessageList({ messages, isLoading, currentCharacterId, isMaster = false }: MessageListProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const currentTag = useChatCurrentTag();

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
        logger.info('📜 New message arrived, but user scrolled up - not auto-scrolling');
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
          // Calculate if message should be dimmed based on current tag
          const isDimmed = shouldDimMessage(message, currentTag);

          return <MessageItem key={message._id} message={message} isDimmed={isDimmed} />;
        })}
    </div>
  );
}
