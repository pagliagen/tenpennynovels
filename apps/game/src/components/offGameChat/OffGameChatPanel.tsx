/**
 * OffGame Chat Panel Component
 *
 * Main controller for OffGame chat system.
 * Manages view state machine: list ↔ thread ↔ new
 * Subscribes to WebSocket for real-time updates.
 *
 * @module components/offGameChat/OffGameChatPanel
 * @since 2.0.0
 */

'use client';

import { useState, useEffect } from 'react';
import { useOffGameChatWebSocket } from '@/hooks/useOffGameChat';
import { OffGameChatListView } from './OffGameChatListView';
import { OffGameChatThreadView } from './OffGameChatThreadView';
import { OffGameNewChatView } from './OffGameNewChatView';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

/**
 * OffGame Chat Panel Props
 *
 * @interface OffGameChatPanelProps
 * @since 2.0.0
 */
interface OffGameChatPanelProps {
  /** Initial view (from window data) */
  initialView?: 'list' | 'thread' | 'new';

  /** Pre-filled recipient ID (from CharacterSheet entry point) */
  prefilledRecipientId?: string;

  /** Pre-filled recipient name (for display) */
  prefilledRecipientName?: string;
}

type ViewState = 'list' | 'thread' | 'new';

/**
 * OffGame Chat Panel Component
 *
 * @component
 * @param {OffGameChatPanelProps} props - Component props
 * @returns {JSX.Element} Chat panel
 * @since 2.0.0
 */
export function OffGameChatPanel({
  initialView = 'list',
  prefilledRecipientId,
  prefilledRecipientName,
}: OffGameChatPanelProps): JSX.Element {
  const [currentView, setCurrentView] = useState<ViewState>(initialView);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // WebSocket subscription for real-time updates
  useOffGameChatWebSocket(selectedChatId);

  // Handle prefilled recipient (from CharacterSheet entry point)
  useEffect(() => {
    if (prefilledRecipientId && prefilledRecipientName) {
      setCurrentView('new');
    }
  }, [prefilledRecipientId, prefilledRecipientName]);

  // Handle chat selection from list
  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    setCurrentView('thread');
  };

  // Handle back to list
  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedChatId(null);
  };

  // Handle new chat
  const handleNewChat = (_type: 'direct' | 'group') => {
    setCurrentView('new');
  };

  // Handle chat created
  const handleChatCreated = (chatId: string) => {
    setSelectedChatId(chatId);
    setCurrentView('thread');
  };

  return (
    <div className={styles.chatPanel}>
      {currentView === 'list' && (
        <OffGameChatListView onChatSelect={handleChatSelect} onNewChat={handleNewChat} />
      )}

      {currentView === 'thread' && selectedChatId && (
        <OffGameChatThreadView chatId={selectedChatId} onBack={handleBackToList} />
      )}

      {currentView === 'new' && (
        <OffGameNewChatView
          initialRecipientId={prefilledRecipientId}
          initialRecipientName={prefilledRecipientName}
          onBack={handleBackToList}
          onCreated={handleChatCreated}
        />
      )}
    </div>
  );
}
