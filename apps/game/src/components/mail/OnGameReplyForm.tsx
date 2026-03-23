/**
 * OnGame Reply Form Component
 *
 * Quick reply form in thread view.
 * Type selector + textarea + send button.
 *
 * @module components/mail/OnGameReplyForm
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';

import { useMessageTypes, useWallet, useSendOnGameMessage } from '@/hooks/useOnGameMail';
import styles from '@/styles/components/mail/OnGameMail.module.scss';

interface OnGameReplyFormProps {
  partnerId: string;
  partnerName: string;
  lastSubject?: string;
  onReplySent: () => void;
}

export function OnGameReplyForm({
  partnerId,
  partnerName,
  lastSubject,
  onReplySent,
}: OnGameReplyFormProps): JSX.Element {
  const { data: messageTypes = {} } = useMessageTypes();
  const { data: wallet } = useWallet();
  const sendMessage = useSendOnGameMessage();

  const [selectedType, setSelectedType] = useState('note');
  const [content, setContent] = useState('');

  const typeConfig = messageTypes[selectedType];
  const maxLength = typeConfig?.maxLength || 200;
  const postageCost = typeConfig?.postageRequired || 0;
  const canAfford = wallet ? wallet.total >= postageCost : true;

  const handleSend = async () => {
    if (!content.trim() || !canAfford) return;

    try {
      await sendMessage.mutateAsync({
        messageType: selectedType,
        to: [partnerId],
        subject: `Re: ${lastSubject || 'Conversazione'}`,
        content: content.trim(),
        deliveryTarget: { type: 'character' },
        isExpress: false,
      });

      setContent('');
      onReplySent();
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > maxLength;

  return (
    <div className={styles.replyForm}>
      <div className={styles.formRow}>
        <select
          className={styles.typeSelector}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          {Object.entries(messageTypes).map(([key, config]) => (
            <option key={key} value={key}>
              {config.icon} {config.displayName} ({config.postageRequired}p)
            </option>
          ))}
        </select>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={`Rispondi a ${partnerName}...`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={maxLength}
      />

      <div className={styles.formFooter}>
        <span
          className={`${styles.charCount} ${isOverLimit ? styles.error : charCount > maxLength * 0.9 ? styles.warning : ''}`}
        >
          {charCount} / {maxLength}
        </span>

        <span className={styles.postageCost}>Costo: {postageCost}p</span>

        <button
          type="button"
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!content.trim() || isOverLimit || !canAfford || sendMessage.isPending}
        >
          {sendMessage.isPending ? 'Invio...' : 'Invia'}
        </button>
      </div>
    </div>
  );
}
