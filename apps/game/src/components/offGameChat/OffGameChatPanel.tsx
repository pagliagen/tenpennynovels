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
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

import { OffGameChatListView } from './OffGameChatListView';
import { OffGameChatThreadView } from './OffGameChatThreadView';
import { OffGameNewChatView } from './OffGameNewChatView';

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

  /** Timestamp della richiesta di apertura: cambia a ogni clic su "scrivi a..." */
  openedAt?: number;
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
  openedAt,
}: OffGameChatPanelProps): JSX.Element {
  const [currentView, setCurrentView] = useState<ViewState>(initialView);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Destinatario precompilato attivo. Vive nello stato (non solo nelle props) perché
  // i dati della finestra restano gli stessi dopo l'uso: senza azzerarlo, "Nuova chat"
  // dalla lista ripresenterebbe il vecchio destinatario.
  const [prefill, setPrefill] = useState<{ id: string; name: string; key: number } | null>(() =>
    prefilledRecipientId && prefilledRecipientName
      ? { id: prefilledRecipientId, name: prefilledRecipientName, key: openedAt ?? 0 }
      : null
  );

  // WebSocket subscription for real-time updates
  useOffGameChatWebSocket(selectedChatId);

  // Nuova richiesta "scrivi a..." (scheda personaggio, Presenti): vale anche per lo
  // stesso destinatario, grazie a openedAt che cambia a ogni apertura.
  useEffect(() => {
    if (prefilledRecipientId && prefilledRecipientName) {
      setPrefill({ id: prefilledRecipientId, name: prefilledRecipientName, key: openedAt ?? 0 });
      setCurrentView('new');
    }
  }, [prefilledRecipientId, prefilledRecipientName, openedAt]);

  // Handle chat selection from list
  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    setCurrentView('thread');
  };

  // Handle back to list
  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedChatId(null);
    setPrefill(null);
  };

  // Handle new chat
  const handleNewChat = (_type: 'direct' | 'group') => {
    setPrefill(null);
    setCurrentView('new');
  };

  // Handle chat created
  const handleChatCreated = (chatId: string) => {
    setPrefill(null);
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
          key={prefill ? `${prefill.id}-${prefill.key}` : 'manual'}
          initialRecipientId={prefill?.id}
          initialRecipientName={prefill?.name}
          onBack={handleBackToList}
          onCreated={handleChatCreated}
        />
      )}
    </div>
  );
}
