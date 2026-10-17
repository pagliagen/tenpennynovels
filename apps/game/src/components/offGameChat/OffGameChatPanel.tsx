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

import { useEffect, useRef, useState } from 'react';

import { useCreateOffGameChatAndSync, useOffGameChatWebSocket } from '@/hooks/useOffGameChat';
import { parseError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
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

  /** Crea/riapre subito la chat 1 a 1 col destinatario precompilato e apre il thread */
  autoStart?: boolean;
}

/** 'opening' = chat in creazione dopo un "scrivi a..." (autoStart) */
type ViewState = 'list' | 'thread' | 'new' | 'opening';

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
  autoStart = false,
}: OffGameChatPanelProps): JSX.Element {
  const [currentView, setCurrentView] = useState<ViewState>(
    autoStart && prefilledRecipientId && prefilledRecipientName ? 'opening' : initialView
  );
  const [openError, setOpenError] = useState<string | null>(null);
  const { createAndSync } = useCreateOffGameChatAndSync();
  // Richiesta già avviata: evita doppi invii (doppio clic, doppio effect in sviluppo)
  const startedRequestRef = useRef<string | null>(null);
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
    if (!prefilledRecipientId || !prefilledRecipientName) return;

    setPrefill({ id: prefilledRecipientId, name: prefilledRecipientName, key: openedAt ?? 0 });
    setOpenError(null);

    if (!autoStart) {
      setCurrentView('new');
      return;
    }

    const requestKey = `${prefilledRecipientId}-${openedAt ?? 0}`;
    if (startedRequestRef.current === requestKey) return;
    startedRequestRef.current = requestKey;
    setCurrentView('opening');

    void (async () => {
      try {
        const chatId = await createAndSync({ type: 'direct', participants: [prefilledRecipientId] });
        // Nel frattempo l'utente ha aperto un'altra richiesta: questa non va più mostrata
        if (startedRequestRef.current !== requestKey) return;
        if (chatId) {
          setPrefill(null);
          setSelectedChatId(chatId);
          setCurrentView('thread');
        } else {
          setCurrentView('new');
        }
      } catch (error) {
        logger.error('Apertura chat OFF-GAME fallita:', { error });
        if (startedRequestRef.current !== requestKey) return;
        // Si ripiega sul form con destinatario compilato, che mostra il motivo
        setOpenError(parseError(error).getUserMessage());
        setCurrentView('new');
      }
    })();
  }, [prefilledRecipientId, prefilledRecipientName, openedAt, autoStart, createAndSync]);

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
    setOpenError(null);
  };

  // Handle new chat
  const handleNewChat = (_type: 'direct' | 'group') => {
    setPrefill(null);
    setOpenError(null);
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

      {currentView === 'opening' && (
        <div className={styles.opening} role="status">
          Apro la chat con {prefill?.name ?? prefilledRecipientName}…
        </div>
      )}

      {currentView === 'new' && (
        <OffGameNewChatView
          key={prefill ? `${prefill.id}-${prefill.key}` : 'manual'}
          initialRecipientId={prefill?.id}
          initialRecipientName={prefill?.name}
          initialError={openError}
          onBack={handleBackToList}
          onCreated={handleChatCreated}
        />
      )}
    </div>
  );
}
