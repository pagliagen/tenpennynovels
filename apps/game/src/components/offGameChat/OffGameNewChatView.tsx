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

import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import { RecipientSelector } from '@/components/mail/RecipientSelector';
import { useCreateOffGameChat } from '@/hooks/useOffGameChat';
import { queryKeys } from '@/lib/api/queryClient';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

interface OffGameNewChatViewProps {
  initialRecipientId?: string;
  initialRecipientName?: string;
  onBack: () => void;
  onCreated: (chatId: string) => void;
}

/** Supporta risposte `{ data: { _id } }` e `{ data: { data: { _id } } }` dal gateway. */
function extractCreatedOffGameChatId(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') return undefined;
  const root = payload as { data?: unknown };
  const layer1 = root.data;
  if (!layer1 || typeof layer1 !== 'object') return undefined;
  const o1 = layer1 as { _id?: unknown; data?: unknown };
  if (typeof o1._id === 'string') return o1._id;
  const layer2 = o1.data;
  if (layer2 && typeof layer2 === 'object' && typeof (layer2 as { _id?: unknown })._id === 'string') {
    return (layer2 as { _id: string })._id;
  }
  return undefined;
}

export function OffGameNewChatView({
  initialRecipientId,
  initialRecipientName: _initialRecipientName,
  onBack,
  onCreated,
}: OffGameNewChatViewProps): JSX.Element {
  const [chatType, setChatType] = useState<'direct' | 'group'>('direct');
  const [recipients, setRecipients] = useState<string[]>(
    initialRecipientId ? [initialRecipientId] : []
  );
  const [groupName, setGroupName] = useState('');
  const createChat = useCreateOffGameChat();
  const queryClient = useQueryClient();

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
    if (!isValid || createChat.isPending) return;

    try {
      const response = await createChat.mutateAsync({
        type: chatType,
        name: chatType === 'group' ? groupName.trim() : undefined,
        participants: recipients,
      });

      // Wait for chats list to refetch before navigating
      await queryClient.invalidateQueries({ queryKey: queryKeys.offGameChat.chats });
      await queryClient.refetchQueries({ queryKey: queryKeys.offGameChat.chats });

      // Navigate to the created chat
      const chatId = extractCreatedOffGameChatId(response);
      if (chatId) {
        onCreated(chatId);
      } else {
        onBack();
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
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

        {/* Actions */}
        <div className={styles.actions}>
          <button className="cancel" onClick={onBack} disabled={createChat.isPending}>
            Annulla
          </button>
          <button
            className="submit"
            onClick={handleCreate}
            disabled={!isValid || createChat.isPending}
          >
            {createChat.isPending ? 'Creazione...' : 'Crea Chat'}
          </button>
        </div>
      </div>
    </>
  );
}
