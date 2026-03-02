/**
 * CreateDocumentModal Component
 *
 * Modal for creating new documents + associated route
 * ALWAYS creates document + route together (documents cannot exist without routes)
 */

import React, { useState } from 'react';
import { createRoute } from '@/lib/api/documents';
import { useNotificationStore } from '@/store/notificationStore';
import { useQueryClient } from '@tanstack/react-query';
import styles from '@/styles/components/Modal.module.scss';

interface Route {
  _id: string;
  path: string;
  title: string;
  kind: 'document' | 'category' | 'redirect';
}

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
  availableRoutes: Route[];
  preselectedParentId?: string | null;
  onDocumentCreated: (documentId: string) => void;
}

export function CreateDocumentModal({
  isOpen,
  onClose,
  type,
  availableRoutes,
  preselectedParentId,
  onDocumentCreated
}: CreateDocumentModalProps) {
  const [parentRouteId, setParentRouteId] = useState<string>(preselectedParentId || '');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isDraft, setIsDraft] = useState(true);
  const [visible, setVisible] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track if user manually edited slug
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const addNotification = useNotificationStore(state => state.addNotification);
  const queryClient = useQueryClient();

  // Update parentRouteId when preselectedParentId changes
  React.useEffect(() => {
    if (preselectedParentId) {
      setParentRouteId(preselectedParentId);
    }
  }, [preselectedParentId]);

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

    if (!parentRouteId) {
      addNotification({
        type: 'error',
        message: 'Devi selezionare una rotta parent'
      });
      return;
    }

    if (!title.trim() || !slug.trim()) {
      addNotification({
        type: 'error',
        message: 'Titolo e slug sono obbligatori'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate path from parent + slug
      const parentRoute = availableRoutes.find(r => r._id === parentRouteId);
      const calculatedPath = parentRoute
        ? `${parentRoute.path}/${slug.trim()}`
        : slug.trim();

      // Create route + document together
      const createdRoute = await createRoute({
        path: calculatedPath,
        type,
        kind: 'document',
        title: title.trim(),
        description: description.trim() || undefined,
        documentData: {
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          isDraft,
          visible
        },
        parentId: parentRouteId,
        isPublic,
        enabled,
        order: 0
      });

      addNotification({
        type: 'success',
        message: 'Documento e route creati con successo'
      });

      // Refresh documents list (routes + documents tree)
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });

      // Open edit modal for content
      if (createdRoute.rootDocumentId) {
        onDocumentCreated(createdRoute.rootDocumentId);
      } else {
        onClose();
      }
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

  // Filter routes: only categories or documents (no redirects) for parent selection
  const selectableRoutes = availableRoutes.filter(r => r.kind !== 'redirect');

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={`${styles.modal} ${styles.medium}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Crea Nuovo Documento</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {/* Route Parent Selection */}
          <div className={styles.formField}>
            <label htmlFor="parentRoute">Rotta Parent *</label>
            {selectableRoutes.length === 0 ? (
              <div className={styles.infoBox}>
                ⚠️ Nessuna route disponibile. Crea prima una route di tipo "category" o "document" da usare come parent.
              </div>
            ) : (
              <>
                <select
                  id="parentRoute"
                  value={parentRouteId}
                  onChange={(e) => setParentRouteId(e.target.value)}
                  disabled={isSubmitting || !!preselectedParentId}
                  required
                >
                  <option value="">-- Seleziona una route --</option>
                  {selectableRoutes.map(route => (
                    <option key={route._id} value={route._id}>
                      {route.path} - {route.title}
                    </option>
                  ))}
                </select>
                <small>
                  {preselectedParentId
                    ? '✓ Parent preselezionato dalla route'
                    : 'Seleziona sotto quale route creare questo documento'}
                </small>
              </>
            )}
          </div>

          {/* Unified Fields */}
          <div className={styles.formField}>
            <label htmlFor="title">Titolo *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Titolo del documento e della route"
              required
              disabled={isSubmitting}
            />
            <small>Utilizzato per route e documento</small>
          </div>

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
              {parentRouteId && (() => {
                const parent = availableRoutes.find(r => r._id === parentRouteId);
                return parent ? ` • URL finale: ${parent.path}/${slug || '...'}` : '';
              })()}
            </small>
          </div>

          <div className={styles.formField}>
            <label htmlFor="description">Descrizione</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrizione"
              rows={3}
              disabled={isSubmitting}
            />
            <small>Utilizzata per route e documento</small>
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
              {' '}Route pubblica (accessibile senza login)
            </label>
          </div>

          <div className={styles.formField}>
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={isSubmitting}
              />
              {' '}Route abilitata
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
              disabled={isSubmitting || selectableRoutes.length === 0}
            >
              {isSubmitting ? 'Creazione...' : 'Crea Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
