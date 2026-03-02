/**
 * OnGame Compose View Component
 *
 * Full compose form for new messages.
 * Recipient selector, message type, subject, content, delivery options.
 *
 * @module components/mail/OnGameComposeView
 * @since 2.0.0
 */

'use client';

import { useState, useEffect } from 'react';
import { useMessageTypes, useWallet, useSendOnGameMessage } from '@/hooks/useOnGameMail';
import { RecipientSelector } from './RecipientSelector';
import styles from '@/styles/components/mail/OnGameMail.module.scss';

interface OnGameComposeViewProps {
  initialRecipientId?: string;
  initialRecipientName?: string;
  onBack: () => void;
  onSent: (partnerId: string) => void;
}

export function OnGameComposeView({
  initialRecipientId,
  initialRecipientName: _initialRecipientName,
  onBack,
  onSent,
}: OnGameComposeViewProps): JSX.Element {
  const { data: messageTypes = {} } = useMessageTypes();
  const { data: wallet, isError: walletError } = useWallet();
  const sendMessage = useSendOnGameMessage();

  const [recipients, setRecipients] = useState<string[]>(
    initialRecipientId ? [initialRecipientId] : []
  );
  const [messageType, setMessageType] = useState('note');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [deliveryTarget, setDeliveryTarget] = useState<'character' | 'residence'>('character');
  const [isExpress, setIsExpress] = useState(false);

  const typeConfig = messageTypes[messageType];
  const maxLength = typeConfig?.maxLength || 200;
  const basePostage = typeConfig?.postageRequired || 0;
  const expressCost = isExpress && typeConfig?.expressCostMultiplier
    ? basePostage * typeConfig.expressCostMultiplier
    : basePostage;
  const totalCost = Math.ceil(expressCost);
  // If wallet error, assume can afford (don't block on wallet issues)
  const canAfford = walletError ? true : (wallet ? wallet.total >= totalCost : true);

  // Handle message type change
  useEffect(() => {
    if (typeConfig) {
      // Reset delivery target if not compatible
      if (typeConfig.deliveryMethod === 'to_residence') {
        setDeliveryTarget('residence');
      } else if (typeConfig.deliveryMethod === 'to_person') {
        setDeliveryTarget('character');
      }

      // Truncate recipients if exceeds new limit
      if (recipients.length > typeConfig.maxRecipients) {
        setRecipients(recipients.slice(0, typeConfig.maxRecipients));
      }
    }
  }, [messageType, typeConfig]);

  const handleSend = async () => {
    if (!recipients.length || !content.trim() || !canAfford) return;

    try {
      await sendMessage.mutateAsync({
        messageType,
        to: recipients,
        subject: subject || 'Senza oggetto',
        content: content.trim(),
        deliveryTarget: { type: deliveryTarget },
        isExpress,
      });

      // Navigate to thread with first recipient
      onSent(recipients[0]!);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > maxLength;

  return (
    <div className={styles.composeView}>
      <div className={styles.composeHeader}>
        <h2>Nuovo Messaggio</h2>
      </div>

      {/* Recipient selector */}
      <RecipientSelector
        value={recipients}
        onChange={setRecipients}
        maxRecipients={typeConfig?.maxRecipients || 1}
        allowMultiple={typeConfig?.allowMultipleRecipients || false}
      />

      {/* Message type */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Tipo di messaggio</label>
        <select
          className={styles.input}
          value={messageType}
          onChange={(e) => setMessageType(e.target.value)}
        >
          {Object.entries(messageTypes).map(([key, config]) => (
            <option key={key} value={key}>
              {config.icon} {config.displayName} - {config.postageRequired}p
            </option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Oggetto</label>
        <input
          type="text"
          className={styles.input}
          placeholder="Oggetto del messaggio..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={100}
        />
      </div>

      {/* Content */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Contenuto ({charCount}/{maxLength})
        </label>
        <textarea
          className={styles.textarea}
          placeholder="Scrivi il tuo messaggio..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={maxLength}
          style={{ minHeight: '150px' }}
        />
      </div>

      {/* Delivery options (if type supports it) */}
      {typeConfig?.deliveryMethod === 'both_options' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Consegna</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                checked={deliveryTarget === 'character'}
                onChange={() => setDeliveryTarget('character')}
              />
              <span>A mano</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                checked={deliveryTarget === 'residence'}
                onChange={() => setDeliveryTarget('residence')}
              />
              <span>Per posta</span>
            </label>
          </div>
        </div>
      )}

      {/* Express delivery (if type supports it) */}
      {typeConfig?.expressCostMultiplier && (
        <div className={styles.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={isExpress}
              onChange={(e) => setIsExpress(e.target.checked)}
            />
            <span className={styles.label} style={{ marginBottom: 0 }}>
              Consegna espressa (×{typeConfig.expressCostMultiplier})
            </span>
          </label>
        </div>
      )}

      {/* Postage summary */}
      <div style={{ padding: '1rem', background: 'rgba(40, 30, 20, 0.8)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span>Costo postale:</span>
          <span className={styles.postageCost}>{totalCost}p</span>
        </div>
        {!walletError && wallet && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#999' }}>
            <span>Saldo disponibile:</span>
            <span style={{ color: canAfford ? '#4ade80' : '#ef4444' }}>
              {wallet.total}p
            </span>
          </div>
        )}
        {walletError && (
          <div style={{ fontSize: '0.8125rem', color: '#fbbf24', marginTop: '0.5rem' }}>
            ⚠️ Impossibile verificare saldo - procedi comunque
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.composeActions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onBack}
          disabled={sendMessage.isPending}
        >
          Annulla
        </button>
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSend}
          disabled={
            !recipients.length ||
            !content.trim() ||
            isOverLimit ||
            !canAfford ||
            sendMessage.isPending
          }
        >
          {sendMessage.isPending ? 'Invio...' : 'Invia'}
        </button>
      </div>
    </div>
  );
}
