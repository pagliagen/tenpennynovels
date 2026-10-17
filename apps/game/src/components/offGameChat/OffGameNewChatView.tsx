/**
 * OffGame New Chat View Component
 *
 * Form to create a new direct (1:1) or group chat (up to 5 participants).
 * Reuses RecipientSelector from OnGame mail (filters self).
 *
 * @module components/offGameChat/OffGameNewChatView
 * @since 2.0.0
 */

'use client';

import { useMemo, useState, useEffect } from 'react';

import { RecipientSelector } from '@/components/RecipientSelector';
import { useCreateOffGameChatAndSync } from '@/hooks/useOffGameChat';
import { parseError } from '@/lib/api/errors';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';
import { logger } from '@/lib/logger';

interface OffGameNewChatViewProps {
  initialRecipientId?: string;
  initialRecipientName?: string;
  /** Errore da mostrare subito (es. apertura diretta della chat fallita) */
  initialError?: string | null;
  onBack: () => void;
  onCreated: (chatId: string) => void;
}

export function OffGameNewChatView({
  initialRecipientId,
  initialRecipientName,
  initialError = null,
  onBack,
  onCreated,
}: OffGameNewChatViewProps): JSX.Element {
  const [chatType, setChatType] = useState<'direct' | 'group'>('direct');
  const [recipients, setRecipients] = useState<string[]>(
    initialRecipientId ? [initialRecipientId] : []
  );
  const [groupName, setGroupName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const knownNames = useMemo(
    () => (initialRecipientId && initialRecipientName ? { [initialRecipientId]: initialRecipientName } : undefined),
    [initialRecipientId, initialRecipientName]
  );
  const { createAndSync, isPending } = useCreateOffGameChatAndSync();

  // Update chat type based on recipient count
  useEffect(() => {
    if (recipients.length > 1) {
      setChatType('group');
    }
  }, [recipients.length]);

  // Validation
  const maxRecipients = chatType === 'direct' ? 1 : 5;
  const isValid =
    recipients.length > 0 &&
    recipients.length <= maxRecipients &&
    (chatType === 'direct' || (chatType === 'group' && groupName.trim().length > 0));

  // Handle create
  const handleCreate = async () => {
    if (!isValid || isPending) return;

    setErrorMessage(null);
    try {
      const chatId = await createAndSync({
        type: chatType,
        name: chatType === 'group' ? groupName.trim() : undefined,
        participants: recipients,
      });

      // Navigate to the created chat
      if (chatId) {
        onCreated(chatId);
      } else {
        onBack();
      }
    } catch (error) {
      logger.error('Failed to create chat:', { error });
      setErrorMessage(parseError(error).getUserMessage());
    }
  };

  return (
    <>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack} title="Annulla">
          ←
        </button>
        <h2 className={styles.title}>Nuova Chat</h2>
      </div>

      {/* Form */}
      <div className={styles.newChatView}>
        {/* Chat Type */}
        <div className={styles.formGroup}>
          <label>Tipo di chat</label>
          <select
            value={chatType}
            onChange={(e) => setChatType(e.target.value as 'direct' | 'group')}
            disabled={recipients.length > 1}
          >
            <option value="direct">Diretta (1 vs 1)</option>
            <option value="group">Gruppo (max 5 persone)</option>
          </select>
        </div>

        {/* Recipient Selector */}
        <RecipientSelector
          value={recipients}
          onChange={setRecipients}
          maxRecipients={maxRecipients}
          allowMultiple={chatType === 'group'}
          knownNames={knownNames}
        />

        {/* Group Name (only for groups) */}
        {chatType === 'group' && (
          <div className={styles.formGroup}>
            <label>Nome del gruppo *</label>
            <input
              type="text"
              placeholder="Es. Gruppo dei Cacciatori"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </div>
        )}

        {errorMessage && (
          <p className={styles.formError} role="alert">
            {errorMessage}
          </p>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button className="cancel" onClick={onBack} disabled={isPending}>
            Annulla
          </button>
          <button
            className="submit"
            onClick={handleCreate}
            disabled={!isValid || isPending}
          >
            {isPending ? 'Creazione...' : 'Crea Chat'}
          </button>
        </div>
      </div>
    </>
  );
}
