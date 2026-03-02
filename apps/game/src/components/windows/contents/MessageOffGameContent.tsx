/**
 * Message OffGame Content Component
 *
 * Window content entry point for OffGame chat system.
 * Renders OffGameChatPanel with window data props.
 *
 * @module components/windows/contents/MessageOffGameContent
 * @since 2.0.0
 */

'use client';

import { OffGameChatPanel } from '@/components/offGameChat/OffGameChatPanel';

/**
 * Message OffGame Content Props
 *
 * @interface MessageOffGameContentProps
 * @since 2.0.0
 */
interface MessageOffGameContentProps {
  /** Conversation ID (singleton: 'offgame-main') */
  conversationId: string;

  /** Initial view to show */
  initialView?: 'list' | 'thread' | 'new';

  /** Pre-filled recipient ID (from CharacterSheet entry point) */
  prefilledRecipientId?: string;

  /** Pre-filled recipient name (for display) */
  prefilledRecipientName?: string;
}

/**
 * Message OffGame Content Component
 *
 * @component
 * @param {MessageOffGameContentProps} props - Component props
 * @returns {JSX.Element} OffGame chat panel
 * @since 2.0.0
 */
export function MessageOffGameContent({
  initialView = 'list',
  prefilledRecipientId,
  prefilledRecipientName,
}: MessageOffGameContentProps): JSX.Element {
  return (
    <OffGameChatPanel
      initialView={initialView}
      prefilledRecipientId={prefilledRecipientId}
      prefilledRecipientName={prefilledRecipientName}
    />
  );
}
