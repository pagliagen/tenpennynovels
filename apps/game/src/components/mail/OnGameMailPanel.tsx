/**
 * OnGame Mail Panel Component
 *
 * Main controller for the mail system.
 * Manages view state machine: inbox ↔ thread ↔ compose
 * Subscribes to WebSocket for real-time updates.
 *
 * @module components/mail/OnGameMailPanel
 * @since 2.0.0
 */

'use client';

import { useState, useEffect } from 'react';
import { useOnGameMailWebSocket } from '@/hooks/useOnGameMail';
import { OnGameInboxView } from './OnGameInboxView';
import { OnGameThreadView } from './OnGameThreadView';
import { OnGameComposeView } from './OnGameComposeView';
import styles from '@/styles/components/mail/OnGameMail.module.scss';

/**
 * OnGame Mail Panel Props
 *
 * @interface OnGameMailPanelProps
 * @since 2.0.0
 */
interface OnGameMailPanelProps {
  /** Initial view (from window data) */
  initialView?: 'inbox' | 'compose' | 'thread';

  /** Pre-filled recipient ID (from CharacterSheet entry point) */
  prefilledRecipientId?: string;

  /** Pre-filled recipient name (for display) */
  prefilledRecipientName?: string;
}

type ViewState = 'inbox' | 'thread' | 'compose';

/**
 * OnGame Mail Panel Component
 *
 * @component
 * @param {OnGameMailPanelProps} props - Component props
 * @returns {JSX.Element} Mail panel
 * @since 2.0.0
 */
export function OnGameMailPanel({
  initialView = 'inbox',
  prefilledRecipientId,
  prefilledRecipientName,
}: OnGameMailPanelProps): JSX.Element {
  const [currentView, setCurrentView] = useState<ViewState>(initialView);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState<string>('');

  // WebSocket subscription for real-time updates
  useOnGameMailWebSocket(selectedPartnerId);

  // Handle prefilled recipient (from CharacterSheet entry point)
  useEffect(() => {
    if (prefilledRecipientId && prefilledRecipientName) {
      setCurrentView('compose');
      // Store for potential use after send
      setSelectedPartnerId(prefilledRecipientId);
      setSelectedPartnerName(prefilledRecipientName);
    }
  }, [prefilledRecipientId, prefilledRecipientName]);

  // Handle thread selection from inbox
  const handleThreadSelect = (partnerId: string, partnerName: string) => {
    setSelectedPartnerId(partnerId);
    setSelectedPartnerName(partnerName);
    setCurrentView('thread');
  };

  // Handle back to inbox
  const handleBackToInbox = () => {
    setCurrentView('inbox');
    setSelectedPartnerId(null);
    setSelectedPartnerName('');
  };

  // Handle compose
  const handleCompose = () => {
    setCurrentView('compose');
    // Clear selected partner when composing new message
    setSelectedPartnerId(null);
    setSelectedPartnerName('');
  };

  // Handle message sent from compose view
  const handleMessageSent = (recipientId: string) => {
    // After sending, navigate to thread with that recipient
    setSelectedPartnerId(recipientId);
    // Name will be loaded by thread query
    setCurrentView('thread');
  };

  return (
    <div className={styles.mailPanel}>
      {currentView === 'inbox' && (
        <OnGameInboxView
          onThreadSelect={handleThreadSelect}
          onCompose={handleCompose}
        />
      )}

      {currentView === 'thread' && selectedPartnerId && (
        <OnGameThreadView
          partnerId={selectedPartnerId}
          partnerName={selectedPartnerName}
          onBack={handleBackToInbox}
        />
      )}

      {currentView === 'compose' && (
        <OnGameComposeView
          initialRecipientId={prefilledRecipientId}
          initialRecipientName={prefilledRecipientName}
          onBack={handleBackToInbox}
          onSent={handleMessageSent}
        />
      )}
    </div>
  );
}
