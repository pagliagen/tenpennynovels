/**
 * Message On-Game Content Component
 *
 * Type-specific content for on-game message windows.
 * Victorian postal system with thread list, conversations, and compose view.
 *
 * @module components/windows/contents/MessageOnGameContent
 * @since 2.0.0
 */

'use client';

import { OnGameMailPanel } from '@/components/mail/OnGameMailPanel';

/**
 * Message On-Game Content Props
 *
 * @interface MessageOnGameContentProps
 * @since 2.0.0
 */
interface MessageOnGameContentProps {
  /** Conversation ID (deduplication key, typically 'inbox') */
  conversationId: string;

  /** Initial view (inbox, compose, or thread) */
  initialView?: 'inbox' | 'compose' | 'thread';

  /** Pre-filled recipient ID (from CharacterSheet entry point) */
  prefilledRecipientId?: string;

  /** Pre-filled recipient name (for display) */
  prefilledRecipientName?: string;
}

/**
 * Message On-Game Content Component
 *
 * @component
 * @param {MessageOnGameContentProps} props - Component props
 * @returns {JSX.Element} Message on-game content
 * @since 2.0.0
 */
export function MessageOnGameContent({
  initialView = 'inbox',
  prefilledRecipientId,
  prefilledRecipientName,
}: MessageOnGameContentProps): JSX.Element {
  return (
    <OnGameMailPanel
      initialView={initialView}
      prefilledRecipientId={prefilledRecipientId}
      prefilledRecipientName={prefilledRecipientName}
    />
  );
}
