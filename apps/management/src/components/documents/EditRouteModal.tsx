/**
 * EditRouteModal Component
 *
 * Modal for editing existing routes + associated document
 * Allows modifying route title, path, document title, slug, descriptions, and flags
 */

import React, { useState, useEffect } from 'react';
import { updateRoute, getDocumentById } from '@/lib/api/documents';
import { useNotificationStore } from '@/store/notificationStore';
import { useQueryClient } from '@tanstack/react-query';
import styles from '@/styles/components/Modal.module.scss';

interface EditRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: string;
  route: {
    _id: string;
    path: string;
    // ❌ REMOVED: title, description - edit Document instead
    type: 'ambientazione' | 'approfondimenti' | 'regolamento';
    kind: 'document' | 'category' | 'redirect';
    redirectTo?: string;
    isPublic: boolean;
    enabled: boolean;
    rootDocumentId?: string;
  };
}

export function EditRouteModal({
  isOpen,
  onClose,
  routeId,
  route
}: EditRouteModalProps) {
  const [path, setPath] = useState(route.path);
  // ❌ REMOVED: title, description state (loaded from Document, not Route)
  const [docTitle, setDocTitle] = useState('');              // Document title (not route title!)
  const [slug, setSlug] = useState('');
  const [docDescription, setDocDescription] = useState('');  // Document description (not route description!)
  const [redirectTo, setRedirectTo] = useState(route.redirectTo || '');
  const [isPublic, setIsPublic] = useState(route.isPublic);
  const [enabled, setEnabled] = useState(route.enabled);
  const [isDraft, setIsDraft] = useState(false);
  const [visible, setVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  const addNotification = useNotificationStore(state => state.addNotification);
  const queryClient = useQueryClient();

  // Load document data if route has a document
  useEffect(() => {
    if (!isOpen || !route.rootDocumentId || route.kind === 'redirect') return;

    setIsLoadingDocument(true);
    getDocumentById(route.rootDocumentId)
      .then(doc => {
        setDocTitle(doc.title);              // ✅ Load from Document
        setSlug(doc.slug);
        setDocDescription(doc.description || '');  // ✅ Load from Document
        setIsDraft(doc.status === 'draft');
        setVisible(doc.visibility?.isPublic ?? true);
      })
      .catch(error => {
        addNotification({
          type: 'error',
          message: `Errore caricamento documento: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
        });
      })
      .finally(() => {
        setIsLoadingDocument(false);
      });
  }, [isOpen, route.rootDocumentId, route.kind, addNotification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!path.trim()) {
      addNotification({
        type: 'error',
        message: 'Path è obbligatorio'
      });
      return;
    }

    // Validate document title for non-redirect routes
    if (route.kind !== 'redirect' && !docTitle.trim()) {
      addNotification({
        type: 'error',
        message: 'Titolo documento è obbligatorio'
      });
      return;
    }

    // Validate slug for non-redirect routes
    if (route.kind !== 'redirect' && !slug.trim()) {
      addNotification({
        type: 'error',
        message: 'Slug è obbligatorio per documenti e categorie'
      });
      return;
    }

    if (route.kind === 'redirect' && !redirectTo.trim()) {
      addNotification({
        type: 'error',
        message: 'Inserisci il path di destinazione per il redirect'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build request body (Route update - minimal fields)
      const requestBody: any = {
        path: path.trim(),
        // ❌ REMOVED: title, description - edit Document instead!
        isPublic,
        enabled
      };

      // Add document updates for non-redirect routes
      if (route.kind !== 'redirect' && route.rootDocumentId) {
        requestBody.documentData = {
          title: docTitle.trim(),
          slug: slug.trim(),
          description: docDescription.trim() || undefined,
          isDraft,
          visible
        };
      } else if (route.kind === 'redirect') {
        requestBody.redirectTo = redirectTo.trim();
      }

      await updateRoute(routeId, requestBody);

      addNotification({
        type: 'success',
        message: 'Route aggiornata con successo'
      });

      // Refresh documents list (routes + documents tree)
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });

      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
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
          <h2 className={styles.modalTitle}>Modifica Route</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {isLoadingDocument ? (
          <div className={styles.modalBody}>
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              Caricamento dati documento...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.modalBody}>
            {route.kind !== 'redirect' && (
              <>
                <div className={styles.formField}>
                  <label htmlFor="docTitle">Titolo Documento *</label>
                  <input
                    id="docTitle"
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Titolo del documento"
                    required
                    disabled={isSubmitting}
                  />
                  <small>Titolo del documento (source of truth per navigazione)</small>
                </div>

                <div className={styles.formField}>
                  <label htmlFor="slug">Slug Documento *</label>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="slug-url-friendly"
                    required
                    disabled={isSubmitting}
                  />
                  <small>⚠️ Modificare lo slug può rompere link esistenti</small>
                </div>

                <div className={styles.formField}>
                  <label htmlFor="docDescription">Descrizione Documento</label>
                  <textarea
                    id="docDescription"
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    placeholder="Breve descrizione"
                    rows={3}
                    disabled={isSubmitting}
                  />
                  <small>Descrizione del documento</small>
                </div>
              </>
            )}

            <div className={styles.formField}>
              <label htmlFor="path">Path Route *</label>
              <input
                id="path"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="es: approfondimenti/medicina"
                required
                disabled={isSubmitting}
              />
              <small>⚠️ Modificare il path cambierà l'URL pubblico della route</small>
            </div>

            {route.kind === 'redirect' && (
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

            {route.kind !== 'redirect' && (
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

            <div className={styles.infoBox}>
              ℹ️ Tipo: <strong>{route.type}</strong> | Kind: <strong>{route.kind}</strong>
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
                {isSubmitting ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
