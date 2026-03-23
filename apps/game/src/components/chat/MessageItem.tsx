/**
 * Message Item Component
 *
 * Delegates to MessageCard wrapper which handles all interactive functionality.
 *
 * @module components/chat/MessageItem
 * @since 2.0.0
 */

'use client';

import { useAuthStore } from '@/store/authStore';
import type { ChatMessage } from '@/types/chat';

import { MessageCard } from './MessageCard';

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
 * Message Item Component
 *
 * Simple wrapper that delegates to MessageCard for all functionality.
 *
 * @param {MessageItemProps} props - Component props
 * @returns {JSX.Element} Message item
 */
export function MessageItem({ message, isDimmed = false }: MessageItemProps): JSX.Element {
  const { selectedCharacter } = useAuthStore();

  return (
    <MessageCard
      message={message}
      isDimmed={isDimmed}
      currentCharacterId={selectedCharacter?._id || ''}
    />
  );
}
