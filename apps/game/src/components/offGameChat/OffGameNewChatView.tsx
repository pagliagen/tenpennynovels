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

import { useState, useEffect } from 'react';
import { useCreateOffGameChat } from '@/hooks/useOffGameChat';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryClient';
import { RecipientSelector } from '@/components/mail/RecipientSelector';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

interface OffGameNewChatViewProps {
  initialRecipientId?: string;
  initialRecipientName?: string;
  onBack: () => void;
  onCreated: (chatId: string) => void;
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
      const chatId = (response as any).data?._id || (response as any).data?.data?._id;
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
