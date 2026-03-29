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

import { useState } from 'react';
import { OnGameInbox } from '@/components/messaging/OnGameInbox';
import { OnGameThread } from '@/components/messaging/OnGameThread';
import { OnGameCompose } from '@/components/messaging/OnGameCompose';

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

type ViewState =
  | { type: 'inbox' }
  | { type: 'thread'; threadId: string; partnerName: string }
  | {
      type: 'compose';
      replyToMessageId?: string;
      prefilledSubject?: string;
      prefilledRecipientId?: string;
      prefilledRecipientName?: string;
    };

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
  const [viewState, setViewState] = useState<ViewState>(() => {
    if (initialView === 'compose') {
      return {
        type: 'compose',
        prefilledRecipientId,
        prefilledRecipientName,
      };
    }
    return { type: 'inbox' };
  });

  const handleThreadSelect = (threadId: string, partnerName: string) => {
    setViewState({ type: 'thread', threadId, partnerName });
  };

  const handleCompose = () => {
    setViewState({ type: 'compose' });
  };

  const handleReply = (replyToMessageId?: string, prefilledSubject?: string) => {
    setViewState({
      type: 'compose',
      replyToMessageId,
      prefilledSubject,
    });
  };

  const handleBack = () => {
    setViewState({ type: 'inbox' });
  };

  const handleComposeSuccess = () => {
    setViewState({ type: 'inbox' });
  };

  if (viewState.type === 'inbox') {
    return <OnGameInbox onThreadSelect={handleThreadSelect} onCompose={handleCompose} />;
  }

  if (viewState.type === 'thread') {
    return (
      <OnGameThread
        threadId={viewState.threadId}
        onBack={handleBack}
        onReply={handleReply}
      />
    );
  }

  if (viewState.type === 'compose') {
    return (
      <OnGameCompose
        onCancel={handleBack}
        onSuccess={handleComposeSuccess}
        prefilledRecipientId={viewState.prefilledRecipientId}
        prefilledRecipientName={viewState.prefilledRecipientName}
        replyToMessageId={viewState.replyToMessageId}
        prefilledSubject={viewState.prefilledSubject}
      />
    );
  }

  return <div>Unknown view state</div>;
}
