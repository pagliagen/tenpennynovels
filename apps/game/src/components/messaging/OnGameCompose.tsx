/**
 * OnGame Compose Component
 *
 * Form for composing on-game messages
 * Supports multi-recipient, message types, subject, content
 */

import { useState, useEffect } from 'react';
import { useSendOnGameMessage } from '@/hooks/useOnGameMessages';
import type { SendMessageRequest } from '@/lib/api/onGameMessages';
import { RecipientSelector } from '@/components/RecipientSelector';
import styles from './OnGameCompose.module.scss';

interface OnGameComposeProps {
  onCancel: () => void;
  onSuccess: () => void;
  prefilledRecipientId?: string;
  prefilledRecipientName?: string;
  replyToMessageId?: string;
  prefilledSubject?: string;
}

export function OnGameCompose({
  onCancel,
  onSuccess,
  prefilledRecipientId,
  prefilledRecipientName,
  replyToMessageId,
  prefilledSubject,
}: OnGameComposeProps) {
  const [recipientIds, setRecipientIds] = useState<string[]>(
    prefilledRecipientId ? [prefilledRecipientId] : []
  );
  const [messageType, setMessageType] = useState<'letter' | 'note' | 'telegram' | 'dispatch' | 'flyer'>('note');
  const [subject, setSubject] = useState(prefilledSubject || '');
  const [content, setContent] = useState('');

  const { mutate: sendMessage, isPending, error, isSuccess } = useSendOnGameMessage();

  // ✅ Chiama onSuccess prop quando mutation completa con successo
  useEffect(() => {
    if (isSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (recipientIds.length === 0) {
      alert('Seleziona almeno un destinatario');
      return;
    }

    if (!subject.trim()) {
      alert('Inserisci un oggetto');
      return;
    }

    if (!content.trim()) {
      alert('Inserisci un contenuto');
      return;
    }

    const data: SendMessageRequest = {
      recipientIds,
      messageType,
      subject: subject.trim(),
      content: content.trim(),
      replyTo: replyToMessageId,
    };

    // ✅ CRITICAL: Non passare onSuccess inline - lascia che il mutation hook
    // gestisca l'invalidation delle queries nel suo onSuccess
    sendMessage(data);
  };

  return (
    <div className={styles.compose}>
      <div className={styles.header}>
        <h2>Nuovo Messaggio</h2>
        <button onClick={onCancel} className={styles.cancelButton}>
          Annulla
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {prefilledRecipientId ? (
          <div className={styles.field}>
            <label htmlFor="recipient">Destinatario</label>
            <input
              type="text"
              value={prefilledRecipientName || prefilledRecipientId}
              disabled
              className={styles.input}
            />
          </div>
        ) : (
          <RecipientSelector
            value={recipientIds}
            onChange={setRecipientIds}
            maxRecipients={10}
            allowMultiple={true}
          />
        )}

        <div className={styles.field}>
          <label htmlFor="messageType">Tipo di Messaggio</label>
          <select
            id="messageType"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as any)}
            className={styles.select}
          >
            <option value="note">Nota (Consegna immediata, gratis)</option>
            <option value="telegram">Telegramma (Ritardo 20min, 3 crediti)</option>
            <option value="letter">Lettera (Ritardo 4h, 1 credito)</option>
            <option value="dispatch">Dispaccio (Solo master)</option>
            <option value="flyer">Volantino (Broadcast, no risposta)</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="subject">Oggetto</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Oggetto del messaggio"
            maxLength={200}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="content">Contenuto</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Scrivi il tuo messaggio..."
            rows={10}
            maxLength={2000}
            className={styles.textarea}
            required
          />
          <div className={styles.charCount}>
            {content.length} / 2000 caratteri
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            Errore nell'invio del messaggio. Riprova.
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" onClick={onCancel} className={styles.cancelButton}>
            Annulla
          </button>
          <button type="submit" disabled={isPending} className={styles.submitButton}>
            {isPending ? 'Invio in corso...' : 'Invia Messaggio'}
          </button>
        </div>
      </form>
    </div>
  );
}
