/**
 * CreateDocumentModal Component
 *
 * Modal for creating new documents with subtype selection.
 */

import React, { useState } from 'react';
import { createDocument, getSubtypes } from '@/lib/api/documents';
import { useNotificationStore } from '@/store/notificationStore';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { DocumentContentEditor } from './DocumentContentEditor';
import styles from '@/styles/components/Modal.module.scss';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'ambientazione' | 'regolamento';
  preselectedParentDocId?: string | null;
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
  const [subtypeId, setSubtypeId] = useState('');
  const [isDraft, setIsDraft] = useState(true);
  const [visible, setVisible] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const addNotification = useNotificationStore(state => state.addNotification);
  const queryClient = useQueryClient();

  // Fetch subtypes for the current type
  const { data: subtypes = [] } = useQuery({
    queryKey: ['admin', 'subtypes', type],
    queryFn: () => getSubtypes(type),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    const autoValue = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    if (!slugManuallyEdited) setSlug(autoValue);
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !slug.trim() || !subtypeId) {
      addNotification({
        type: 'error',
        message: 'Titolo, slug e sottotipo sono obbligatori'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const createdDocument = await createDocument({
        title: title.trim(),
        slug: slug.trim(),
        type,
        subtypeId,
        description: description.trim() || undefined,
        parentId: preselectedParentDocId || null,
        contentDelta: { type: 'doc', content: [] },
        isDraft,
        visible,
        isPublic
      });

      addNotification({
        type: 'success',
        message: preselectedParentDocId
          ? 'Sottodocumento creato con successo'
          : 'Documento creato con successo'
      });

      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
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
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
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

          {/* Subtype Selector */}
          <div className={styles.formField}>
            <label htmlFor="subtypeId">Sottotipo *</label>
            <select
              id="subtypeId"
              value={subtypeId}
              onChange={(e) => setSubtypeId(e.target.value)}
              required
              disabled={isSubmitting}
            >
              <option value="">Seleziona sottotipo...</option>
              {subtypes.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.title} ({st.slug})
                </option>
              ))}
            </select>
            <small>Raggruppa il documento sotto questo sottotipo nella sidebar</small>
          </div>

          {/* Description Editor */}
          <div className={styles.formField}>
            <label>Descrizione</label>
            <DocumentContentEditor
              contentDelta={description}
              onChange={(html) => setDescription(html)}
              htmlMode
              readOnly={isSubmitting}
            />
          </div>

          {/* Checkboxes */}
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

          <div className={styles.formField}>
            <label>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isSubmitting}
              />
              {' '}Pubblico (accessibile senza login)
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
