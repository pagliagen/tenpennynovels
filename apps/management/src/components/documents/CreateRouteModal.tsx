/**
 * CreateRouteModal Component
 *
 * Two modes:
 * 1. Normal mode: Create route with new document
 * 2. Link mode: Create route for existing document (shows parent selector first)
 */

import React, { useState, useEffect } from 'react';
import { createRoute } from '@/lib/api/documents';
import { useNotificationStore } from '@/store/notificationStore';
import { useQueryClient } from '@tanstack/react-query';
import { RouteTreeSelector } from './RouteTreeSelector';
import styles from '@/styles/components/Modal.module.scss';
import type { Route } from '@/types/api/Document';

interface CreateRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  type?: 'ambientazione' | 'approfondimenti' | 'regolamento';
  onRouteCreated?: (route: any) => void;
  // NEW: For linking existing documents
  existingDocumentId?: string;
  existingDocumentData?: {
    title: string;
    slug: string;
    description?: string;
  };
  availableRoutes?: Route[];  // For RouteTreeSelector
}

export function CreateRouteModal({
  isOpen,
  onClose,
  parentId: initialParentId,
  type: initialType,
  onRouteCreated,
  existingDocumentId,
  existingDocumentData,
  availableRoutes = []
}: CreateRouteModalProps) {
  // Mode: 'select-parent' (if linking document) or 'form' (normal)
  const [mode, setMode] = useState<'select-parent' | 'form'>(
    existingDocumentId ? 'select-parent' : 'form'
  );
  const [selectedParentId, setSelectedParentId] = useState<string | null>(initialParentId || null);

  const [path, setPath] = useState('');
  const [type] = useState<'ambientazione' | 'approfondimenti' | 'regolamento'>(initialType || 'ambientazione');
  const [kind, setKind] = useState<'document' | 'category' | 'redirect'>('document');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [redirectTo, setRedirectTo] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [isDraft, setIsDraft] = useState(true);
  const [visible, setVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track if user manually edited slug/path
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [pathManuallyEdited, setPathManuallyEdited] = useState(false);

  const addNotification = useNotificationStore(state => state.addNotification);
  const queryClient = useQueryClient();

  // Pre-fill form with document data when linking existing document
  useEffect(() => {
    if (existingDocumentData) {
      setTitle(existingDocumentData.title);
      setSlug(existingDocumentData.slug);
      setDescription(existingDocumentData.description || '');
      // Auto-generate path from title
      const autoPath = existingDocumentData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      setPath(autoPath);
    }
  }, [existingDocumentData]);

  // Auto-generate path and slug from title (ALWAYS unless manually edited)
  const handleTitleChange = (value: string) => {
    setTitle(value);
    const autoValue = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    // Only auto-update if user hasn't manually edited these fields
    if (!pathManuallyEdited) setPath(autoValue);
    if (!slugManuallyEdited) setSlug(autoValue);
  };

  // Handle manual path edit
  const handlePathChange = (value: string) => {
    setPath(value);
    setPathManuallyEdited(true);
  };

  // Handle manual slug edit
  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugManuallyEdited(true);
  };

  // Reset dependent fields when kind changes
  useEffect(() => {
    if (kind === 'redirect') {
      setSlug('');
    } else {
      setRedirectTo('');
    }
  }, [kind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!path.trim() || !title.trim()) {
      addNotification({
        type: 'error',
        message: 'Path e titolo sono obbligatori'
      });
      return;
    }

    // Validate slug for non-redirect routes
    if (kind !== 'redirect' && !slug.trim()) {
      addNotification({
        type: 'error',
        message: 'Slug è obbligatorio per documenti e categorie'
      });
      return;
    }

    if (kind === 'redirect' && !redirectTo.trim()) {
      addNotification({
        type: 'error',
        message: 'Inserisci il path di destinazione per il redirect'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build request body
      const requestBody: any = {
        slug: path.trim(),  // CHANGED: backend now uses slug (route URL segment)
        type,
        kind,
        title: title.trim(),
        description: description.trim() || undefined,
        parentId: selectedParentId || null,  // CHANGED: explicit null for top-level
        isPublic,
        enabled,
        order: 0
      };

      // If linking existing document, send rootDocumentId
      if (existingDocumentId) {
        requestBody.rootDocumentId = existingDocumentId;
      }
      // Otherwise, send documentData for inline document creation
      // All routes except redirects have a document
      else if (kind !== 'redirect') {
        requestBody.documentData = {
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          isDraft,
          visible
        };
      } else {
        requestBody.redirectTo = redirectTo.trim();
      }

      const createdRoute = await createRoute(requestBody);

      addNotification({
        type: 'success',
        message: 'Route creata con successo'
      });

      // Refresh documents list (routes + documents tree)
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });

      // Call callback if provided
      if (onRouteCreated) {
        onRouteCreated(createdRoute);
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

  // Mode: Select parent route for existing document
  if (mode === 'select-parent') {
    return (
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={`${styles.modal} ${styles.large}`} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              Crea Route per "{existingDocumentData?.title}"
            </h2>
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            <RouteTreeSelector
              routes={availableRoutes}
              type={type}
              onSelectRoute={(routeId) => {
                setSelectedParentId(routeId);
                setMode('form');
              }}
              onCreateRootRoute={() => {
                setSelectedParentId(null);
                setMode('form');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Mode: Form (normal route creation)
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={`${styles.modal} ${styles.medium}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {existingDocumentId ? `Route per "${existingDocumentData?.title}"` : 'Crea Nuova Route'}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formField}>
            <label htmlFor="title">Titolo *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Titolo della route e del documento"
              required
              disabled={isSubmitting}
            />
            <small>Utilizzato per route e documento</small>
          </div>

          <div className={styles.formField}>
            <label htmlFor="path">Path *</label>
            <input
              id="path"
              type="text"
              value={path}
              onChange={(e) => handlePathChange(e.target.value)}
              placeholder="es: approfondimenti/medicina"
              required
              disabled={isSubmitting}
            />
            <small>Auto-generato dal titolo {pathManuallyEdited && '(modificato manualmente)'}</small>
          </div>

          {kind !== 'redirect' && (
            <div className={styles.formField}>
              <label htmlFor="slug">Slug Documento *</label>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="slug-url-friendly"
                required
                disabled={isSubmitting}
              />
              <small>Auto-generato dal titolo {slugManuallyEdited && '(modificato manualmente)'}</small>
            </div>
          )}

          <div className={styles.formField}>
            <label htmlFor="kind">Tipo Route *</label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'document' | 'category' | 'redirect')}
              required
              disabled={isSubmitting}
            >
              <option value="document">Document (route verso documento)</option>
              <option value="category">Category (container senza contenuto)</option>
              <option value="redirect">Redirect (redirect verso altra route)</option>
            </select>
          </div>

          {kind === 'redirect' && (
            <div className={styles.formField}>
              <label htmlFor="redirectTo">Redirect To *</label>
              <input
                id="redirectTo"
                type="text"
                value={redirectTo}
                onChange={(e) => setRedirectTo(e.target.value)}
                placeholder="es: approfondimenti/altro-path"
                required
                disabled={isSubmitting}
              />
              <small>Path di destinazione del redirect</small>
            </div>
          )}

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

          {kind !== 'redirect' && (
            <>
              <div className={styles.formField}>
                <label>
                  <input
                    type="checkbox"
                    checked={isDraft}
                    onChange={(e) => setIsDraft(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  {' '}Documento in bozza (non pubblicato)
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
                  {' '}Documento visibile
                </label>
              </div>
            </>
          )}

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

          {existingDocumentId && (
            <div className={styles.infoBox}>
              📄 Collegamento route a documento esistente: <strong>{existingDocumentData?.title}</strong>
              {selectedParentId && (
                <div style={{ marginTop: '0.5rem' }}>
                  📁 Parent route selezionata
                </div>
              )}
              {!selectedParentId && (
                <div style={{ marginTop: '0.5rem' }}>
                  📁 Route di primo livello
                </div>
              )}
            </div>
          )}
          {!existingDocumentId && selectedParentId && (
            <div className={styles.infoBox}>
              ℹ️ Questa route sarà creata come figlia della route selezionata.
            </div>
          )}

          <div className={styles.modalFooter}>
            {existingDocumentId && (
              <button
                type="button"
                onClick={() => setMode('select-parent')}
                className={styles.backButton}
                disabled={isSubmitting}
              >
                ← Indietro
              </button>
            )}
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
              {isSubmitting ? 'Creazione...' : 'Crea Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
