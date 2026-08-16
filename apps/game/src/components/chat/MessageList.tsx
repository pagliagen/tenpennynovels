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

import { useChatCurrentPosition } from '@/store/chatStore';
import { uiSelectors, useUIStore } from '@/store/uiStore';
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

  /** Current character ID (for position-based visibility) */
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
 * Il backend filtra già i destinatari (skill_check/stat_check via il
 * registry di core/chat/actionTypes/, Raggirare via lo stesso meccanismo):
 * se un messaggio arriva fin qui il personaggio ha già il diritto di
 * vederlo — nessun ricontrollo per-actionType lato client (regola 4,
 * .claude/rules/00-critical.md).
 *
 * Visibility rules:
 * - 'whisper': only sender + targetCharacters + master
 * - 'master_only': master, plus targetCharacters if the master targeted an
 *   "esito riservato" to specific characters (covers actionType 'master' and
 *   'moderation' — moderation is always untargeted, so this is a no-op there)
 * - 'public' / undefined: everyone
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

  // Public (or unspecified, for older/legacy records): visible to everyone
  return true;
}

/**
 * Calculate if a message should be dimmed based on current position
 *
 * Logic:
 * - If no current position selected → show all normally
 * - If message.position !== currentPosition → dim
 * - Applies to ALL message types without exception
 *
 * @param {ChatMessage} message - Message to check
 * @param {string | null} currentPosition - Current active position from chatStore
 * @returns {boolean} True if message should be dimmed
 */
function shouldDimMessage(
  message: ChatMessage,
  currentPosition: string | null
): boolean {
  // No current position selected → show all normally
  if (!currentPosition) {
    return false;
  }

  // Dim if message position doesn't match current position
  return message.position !== currentPosition;
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
 * **Position-Based Visibility**:
 * - Messages with position matching currentPosition → normal visibility
 * - Messages with different position → dimmed (opacity 0.4)
 * - Applies to ALL message types without exception
 *
 * @param {MessageListProps} props - Component props
 * @returns {JSX.Element} Message list
 */
export function MessageList({ messages, isLoading, currentCharacterId, isMaster = false }: MessageListProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const currentPosition = useChatCurrentPosition();
  const autoScrollMode = useUIStore(uiSelectors.chatAutoScrollMode);

  // Track if user is near bottom (for smart auto-scroll)
  const [isNearBottom, setIsNearBottom] = useState(true);

  // 'button' mode only: new message arrived while reading higher up - show
  // a jump-to-bottom indicator instead of silently doing nothing
  const [hasNewMessages, setHasNewMessages] = useState(false);

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
   *
   * Also clears the "new messages" indicator once the user scrolls back
   * down themselves, without waiting for another message to arrive.
   */
  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasNewMessages(false);
    }
  };

  /**
   * Jump to bottom (user clicked the "new messages" indicator)
   */
  const handleJumpToNewMessages = () => {
    scrollToBottom('smooth');
    setHasNewMessages(false);
  };

  /**
   * Auto-Scroll on new messages
   *
   * Behavior depends on the user's "Opzioni Chat" preference
   * (uiStore.chatAutoScrollMode):
   * - 'force': always scroll to the new message, even mid-read
   * - 'button' (default): only auto-scroll if already near bottom
   *   (following conversation); otherwise surface a "new messages"
   *   indicator instead of silently doing nothing.
   */
  useEffect(() => {
    const messageCount = messages.length;
    const prevMessageCount = prevMessageCountRef.current;

    // Check if new message added
    if (messageCount > prevMessageCount) {
      if (autoScrollMode === 'force' || isNearBottom) {
        scrollToBottom('smooth');
        setHasNewMessages(false);
      } else {
        // User scrolled up → do NOT auto-scroll (would lose reading position)
        setHasNewMessages(true);
        logger.info('📜 New message arrived, but user scrolled up - showing indicator instead of auto-scrolling');
      }
    }

    // Update prev count
    prevMessageCountRef.current = messageCount;
  }, [messages.length, isNearBottom, autoScrollMode]);

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
      <div className={styles.messageListWrapper}>
        <div className={styles.messageList}>
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} role="status" aria-label="Loading messages" />
            <p>Caricamento messaggi...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div className={styles.messageListWrapper}>
        <div className={styles.messageList}>
          <div className={styles.messageListEmpty}>
            <p>Nessun messaggio nella chat.</p>
            <p>Inizia la conversazione!</p>
          </div>
        </div>
      </div>
    );
  }

  // Message list
  return (
    <div className={styles.messageListWrapper}>
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
            // Calculate if message should be dimmed based on current position
            const isDimmed = shouldDimMessage(message, currentPosition);

            return <MessageItem key={message._id} message={message} isDimmed={isDimmed} />;
          })}
      </div>

      {autoScrollMode === 'button' && hasNewMessages && (
        <button
          type="button"
          className={styles.newMessagesButton}
          onClick={handleJumpToNewMessages}
        >
          ↓ Nuovi messaggi
        </button>
      )}
    </div>
  );
}
