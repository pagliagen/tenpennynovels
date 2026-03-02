/**
 * CreateDocumentModal Component
 *
 * Modal for creating new documents WITHOUT routes (documents-first approach)
 * Routes can be created later via context menu "Crea Rotta"
 */

import React, { useState } from 'react';
import { createDocument } from '@/lib/api/documents';
import { useNotificationStore } from '@/store/notificationStore';
import { useQueryClient } from '@tanstack/react-query';
import styles from '@/styles/components/Modal.module.scss';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';  // Category context
  preselectedParentDocId?: string | null;                     // For child document creation
  onDocumentCreated: (documentId: string) => void;
}

export function CreateDocumentModal({
  isOpen,
  onClose,
  type,
  preselectedParentDocId,
  onDocumentCreated
}: CreateDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isDraft, setIsDraft] = useState(true);
  const [visible, setVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track if user manually edited slug
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const addNotification = useNotificationStore(state => state.addNotification);
  const queryClient = useQueryClient();

  // Auto-generate slug from title (ALWAYS unless manually edited)
  const handleTitleChange = (value: string) => {
    setTitle(value);
    const autoValue = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    // Only auto-update if user hasn't manually edited
    if (!slugManuallyEdited) setSlug(autoValue);
  };

  // Handle manual slug edit
  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !slug.trim()) {
      addNotification({
        type: 'error',
        message: 'Titolo e slug sono obbligatori'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create document WITHOUT route
      const createdDocument = await createDocument({
        title: title.trim(),
        slug: slug.trim(),
        type,                              // From prop (category context)
        description: description.trim() || undefined,
        parentId: preselectedParentDocId || null,  // From prop (for child docs) or null
        contentDelta: { type: 'doc', content: [] },  // Empty content initially
        isDraft,
        visible
      });

      addNotification({
        type: 'success',
        message: preselectedParentDocId
          ? 'Sottodocumento creato con successo'
          : 'Documento creato con successo'
      });

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });

      // Open edit modal for content
      onDocumentCreated(createdDocument._id);
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nella creazione'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={`${styles.modal} ${styles.medium}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {preselectedParentDocId ? 'Crea Sottodocumento' : 'Crea Nuovo Documento'}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {preselectedParentDocId && (
            <div className={styles.infoBox}>
              ℹ️ Verrà creato un documento figlio. Potrai creare la route in seguito dal menu contestuale.
            </div>
          )}

          {/* Title Field */}
          <div className={styles.formField}>
            <label htmlFor="title">Titolo *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Titolo del documento"
              required
              disabled={isSubmitting}
              autoFocus
            />
            <small>Titolo principale del documento</small>
          </div>

          {/* Slug Field */}
          <div className={styles.formField}>
            <label htmlFor="slug">Slug *</label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="slug-documento"
              required
              disabled={isSubmitting}
            />
            <small>
              Auto-generato dal titolo {slugManuallyEdited && '(modificato manualmente)'}
            </small>
          </div>

          {/* Description Field */}
          <div className={styles.formField}>
            <label htmlFor="description">Descrizione</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrizione del documento"
              rows={3}
              disabled={isSubmitting}
            />
            <small>Descrizione opzionale (utile per ricerca)</small>
          </div>

          {/* Document Checkboxes */}
          <div className={styles.formField}>
            <label>
              <input
                type="checkbox"
                checked={isDraft}
                onChange={(e) => setIsDraft(e.target.checked)}
                disabled={isSubmitting}
              />
              {' '}Bozza (non pubblicato)
            </label>
          </div>

          <div className={styles.formField}>
            <label>
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
                disabled={isSubmitting}
              />
              {' '}Visibile
            </label>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSubmitting}
            >
              Annulla
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creazione...' : 'Crea Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
