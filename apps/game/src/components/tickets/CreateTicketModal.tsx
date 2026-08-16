/**
 * Create Ticket Modal Component
 *
 * Form for creating new support tickets. Two rendering modes:
 * - 'overlay' (default): floating dialog with scrim, per l'uso da un punto
 *   qualsiasi della UI (es. BackgroundTab/DiarioTab) senza un pannello
 *   ticket sotto a cui tornare.
 * - 'inline': nessun overlay/scrim, pensato per essere incorporato in un
 *   pannello che gestisce già la propria navigazione (TicketPanelContent),
 *   con un header "← Torna alla lista" al posto della card fluttuante.
 *
 * @module components/tickets/CreateTicketModal
 */

'use client';

import { useState } from 'react';

import { useTicketCategories, useCreateTicket } from '@/hooks/useTickets';
import styles from '@/styles/components/tickets/CreateTicketModal.module.scss';

interface CreateTicketModalProps {
  onClose: () => void;
  /** Titolo precompilato (es. richieste generate da un punto specifico della UI) */
  initialTitle?: string;
  /** Descrizione precompilata */
  initialContent?: string;
  /** @default 'overlay' */
  variant?: 'overlay' | 'inline';
}

export function CreateTicketModal({ onClose, initialTitle = '', initialContent = '', variant = 'overlay' }: CreateTicketModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState('');
  const [content, setContent] = useState(initialContent);

  const { data: categories = [], isLoading: loadingCategories } = useTicketCategories();
  const createTicket = useCreateTicket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !category || !content.trim()) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    try {
      await createTicket.mutateAsync({
        title: title.trim(),
        category,
        content: content.trim()
      });

      alert('Ticket creato con successo!');
      onClose();
    } catch (error: any) {
      alert(error.message || 'Errore nella creazione del ticket');
    }
  };

  const canSubmit = !createTicket.isPending && !!title.trim() && !!category && !!content.trim();

  const form = (
    <form onSubmit={handleSubmit}>
      {/* Category */}
      <div className={styles.field}>
        <label className={styles.label}>
          Categoria *
        </label>
        {loadingCategories ? (
          <p className={styles.loadingText}>Caricamento categorie...</p>
        ) : (
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Seleziona una categoria</option>
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        )}
        {category && categories.find(c => c.value === category)?.description && (
          <p className={styles.hint}>
            {categories.find(c => c.value === category)?.description}
          </p>
        )}
      </div>

      {/* Title */}
      <div className={styles.field}>
        <label className={styles.label}>
          Titolo *
        </label>
        <input
          className={styles.input}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          required
          placeholder="Descrivi brevemente il problema"
        />
        <p className={styles.hintRight}>
          {title.length}/100
        </p>
      </div>

      {/* Content */}
      <div className={styles.fieldLarge}>
        <label className={styles.label}>
          Descrizione *
        </label>
        <textarea
          className={styles.textarea}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          required
          placeholder="Descrivi dettagliatamente la tua richiesta o problema..."
        />
        <p className={styles.hintRight}>
          {content.length}/5000
        </p>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onClose}
          disabled={createTicket.isPending}
        >
          Annulla
        </button>
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={!canSubmit}
        >
          {createTicket.isPending ? 'Creazione...' : 'Invia Richiesta'}
        </button>
      </div>
    </form>
  );

  if (variant === 'inline') {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <button type="button" onClick={onClose} className={styles.backBtn}>
            ← Torna alla lista
          </button>
          <h2 className={styles.title}>
            Nuovo Ticket
          </h2>
        </div>

        <div className={styles.formArea}>
          {form}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.dialogTitle}>
          Nuovo Ticket
        </h2>
        {form}
      </div>
    </div>
  );
}
