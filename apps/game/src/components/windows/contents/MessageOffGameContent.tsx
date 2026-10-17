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

  /** Timestamp della richiesta di apertura (vedi WindowData) */
  openedAt?: number;

  /** Crea/riapre subito la chat 1 a 1 col destinatario precompilato (vedi WindowData) */
  autoStart?: boolean;
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
  openedAt,
  autoStart,
}: MessageOffGameContentProps): JSX.Element {
  return (
    <OffGameChatPanel
      initialView={initialView}
      prefilledRecipientId={prefilledRecipientId}
      prefilledRecipientName={prefilledRecipientName}
      openedAt={openedAt}
      autoStart={autoStart}
    />
  );
}
