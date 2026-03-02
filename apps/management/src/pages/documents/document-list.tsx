/**
 * Document List Page (DOCUMENTS-FIRST Architecture)
 *
 * Shows documents as primary tree with route metadata
 * Actions: create/edit/toggle/delete routes, edit/delete documents
 */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useQueryClient } from '@tanstack/react-query';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { DocumentTreeView } from '@/components/documents/DocumentTreeView';
import { EditDocumentModal } from '@/components/documents/EditDocumentModal';
import { HierarchicalDocumentEditor } from '@/components/documents/HierarchicalDocumentEditor';
import { CreateDocumentModal } from '@/components/documents/CreateDocumentModal';
import { EditRouteModal } from '@/components/documents/EditRouteModal';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useDocuments,
  useToggleRouteEnabled,
  useDeleteRoute,
  useUpdateRoute,
  useReorderSiblings,
  useDeleteDocument,
  useToggleDocumentVisibility,
  useToggleDocumentDraft
} from '@/hooks/api/useDocuments';
import { createRoute } from '@/lib/api/documents';
import { useNotificationStore } from '@/store/notificationStore';
import type { DocumentWithRoute } from '@/types/api/Document';
import styles from '@/styles/pages/DocumentList.module.scss';

export default function DocumentList() {
  const router = useRouter();

  // Initialize from URL hash, default to 'ambientazione' if invalid/missing
  const getTypeFromHash = (): 'ambientazione' | 'approfondimenti' | 'regolamento' => {
    if (typeof window === 'undefined') return 'ambientazione';
    const hash = window.location.hash.replace('#', '');
    if (hash === 'approfondimenti') return 'approfondimenti';
    if (hash === 'regolamento') return 'regolamento';
    return 'ambientazione';
  };

  const [typeFilter, setTypeFilter] = useState<'ambientazione' | 'approfondimenti' | 'regolamento'>(getTypeFromHash());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [hierarchicalEditorOpen, setHierarchicalEditorOpen] = useState(false);
  const [hierarchicalRootId, setHierarchicalRootId] = useState<string | null>(null);
  const [createDocModalOpen, setCreateDocModalOpen] = useState(false);
  const [selectedParentDocId, setSelectedParentDocId] = useState<string | null>(null);
  const [editRouteModalOpen, setEditRouteModalOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Hooks
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useDocuments({ type: typeFilter });
  const toggleEnabled = useToggleRouteEnabled();
  const deleteRoute = useDeleteRoute();
  const updateRoute = useUpdateRoute();
  const reorderSiblings = useReorderSiblings();
  const deleteDocument = useDeleteDocument();
  const toggleDocumentVisibility = useToggleDocumentVisibility();
  const toggleDocumentDraft = useToggleDocumentDraft();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  /**
   * Sync filter with URL hash on mount and hash changes
   */
  useEffect(() => {
    // Set initial hash if missing
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (!hash || !['ambientazione', 'approfondimenti', 'regolamento'].includes(hash)) {
        window.location.hash = 'ambientazione';
      }
    }

    // Listen to hash changes
    const handleHashChange = () => {
      const newType = getTypeFromHash();
      setTypeFilter(newType);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  /**
   * Update URL hash when filter changes
   */
  const handleTypeFilterChange = (type: 'ambientazione' | 'approfondimenti' | 'regolamento') => {
    window.location.hash = type;
    setTypeFilter(type);
  };

  /**
   * Toggle route enabled (hide/show)
   */
  const handleToggleEnabled = async (routeId: string) => {
    try {
      await toggleEnabled.mutateAsync(routeId);
      addNotification({ type: 'success', message: 'Stato route aggiornato' });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
      });
    }
  };

  /**
   * Delete route
   */
  const handleDeleteRoute = async (routeId: string) => {
    const confirmed = await confirm({
      title: 'Conferma Eliminazione',
      message: 'Sei sicuro di voler eliminare questa route? Questa azione è irreversibile.'
    });

    if (!confirmed) return;

    try {
      await deleteRoute.mutateAsync(routeId);
      addNotification({ type: 'success', message: 'Route eliminata con successo' });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'eliminazione'
      });
    }
  };

  /**
   * Edit route - opens EditRouteModal
   */
  const handleEditRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setEditRouteModalOpen(true);
  };

  /**
   * Create route for existing document without route (orphan documents)
   * Used by context menu "Crea Rotta" for recovery purposes
   * NOTE: This is the ONLY manual route creation remaining after "+ Nuova Route" removal
   */
  const handleCreateRoute = async (documentId: string) => {
    // Find the document in the tree
    const findDoc = (docs: DocumentWithRoute[], target: string): DocumentWithRoute | null => {
      for (const doc of docs) {
        if (doc._id === target) return doc;
        const found = findDoc(doc.children, target);
        if (found) return found;
      }
      return null;
    };

    const doc = findDoc(data?.data ?? [], documentId);
    if (!doc) return;

    // Check if parent has a route
    const parent = doc.parentId ? findDoc(data?.data ?? [], doc.parentId) : null;

    // Create route automatically (with or without parent)
    try {
      const routeData = {
        parentId: parent?.route?._id || null,  // Auto-detect parent route or create top-level
        slug: doc.slug,
        type: typeFilter,
        kind: 'document' as const,
        title: doc.title,
        description: '',
        rootDocumentId: doc._id,
        isPublic: true,
        enabled: true
      };

      await createRoute(routeData);

      // Invalidate documents query to refresh the tree with new route
      await queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });

      addNotification({
        title: 'Route creata',
        message: `Route "${doc.title}" creata con successo`,
        type: 'success'
      });
    } catch (error: any) {
      addNotification({
        title: 'Errore',
        message: error.message || 'Errore nella creazione route',
        type: 'error'
      });
    }
  };

  /**
   * Create child document (documents-first)
   * Used by context menu "Crea Sottodocumento"
   */
  const handleCreateChildDocument = (parentDocId: string) => {
    setSelectedParentDocId(parentDocId);
    setCreateDocModalOpen(true);
  };

  /**
   * Reorder siblings (drag & drop)
   * Receives full ordered array of sibling IDs
   */
  const handleReorderSiblings = async (parentId: string | null, orderedIds: string[]) => {
    try {
      await reorderSiblings.mutateAsync({ parentId, orderedIds });
      addNotification({ type: 'success', message: `${orderedIds.length} routes riordinate` });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel riordinamento'
      });
    }
  };

  /**
   * Edit document - opens TipTap editor modal
   */
  const handleEditDocument = (documentId: string) => {
    setSelectedDocId(documentId);
    setEditModalOpen(true);
  };

  /**
   * Edit document hierarchically (parent + children in accordion)
   */
  const handleEditDocumentHierarchical = (documentId: string) => {
    setHierarchicalRootId(documentId);
    setHierarchicalEditorOpen(true);
  };

  /**
   * Delete document (soft delete)
   */
  const handleDeleteDocument = async (documentId: string) => {
    const confirmed = await confirm({
      title: 'Conferma Eliminazione',
      message: 'Sei sicuro di voler eliminare questo documento? Questa azione è irreversibile.'
    });

    if (!confirmed) return;

    try {
      await deleteDocument.mutateAsync(documentId);
      addNotification({ type: 'success', message: 'Documento eliminato con successo' });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'eliminazione'
      });
    }
  };

  /**
   * Toggle document visibility (hide/show)
   */
  const handleToggleDocumentVisibility = async (documentId: string) => {
    try {
      await toggleDocumentVisibility.mutateAsync(documentId);
      addNotification({ type: 'success', message: 'Visibilità documento aggiornata' });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
      });
    }
  };

  /**
   * Toggle document draft status
   */
  const handleToggleDocumentDraft = async (documentId: string) => {
    try {
      await toggleDocumentDraft.mutateAsync(documentId);
      addNotification({ type: 'success', message: 'Stato bozza aggiornato' });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
      });
    }
  };

  /**
   * Render error state
   */
  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento documenti</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }


  return (
    <ManagementLayout>
      <Head>
        <title>Gestione Documenti - TenpennyNovels Management</title>
      </Head>

      <div className={styles.documentList}>
        <header className={styles.header}>
          <div>
            <h1>Gestione Documenti</h1>
            <p>Totale: {data?.totalItems ?? 0} documenti</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.createButton}
              onClick={() => {
                setSelectedParentDocId(null);
                setCreateDocModalOpen(true);
              }}
            >
              + Crea Documenti
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${typeFilter === 'ambientazione' ? styles.active : ''}`}
            onClick={() => handleTypeFilterChange('ambientazione')}
          >
            🌍 Ambientazione
          </button>
          <button
            className={`${styles.filterButton} ${typeFilter === 'approfondimenti' ? styles.active : ''}`}
            onClick={() => handleTypeFilterChange('approfondimenti')}
          >
            📚 Approfondimenti
          </button>
          <button
            className={`${styles.filterButton} ${typeFilter === 'regolamento' ? styles.active : ''}`}
            onClick={() => handleTypeFilterChange('regolamento')}
          >
            📜 Regolamento
          </button>
        </div>

        {/* Tree View */}
        {isLoading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : (
          <DocumentTreeView
            documents={data?.data ?? []}
            onCreateRoute={handleCreateRoute}
            onCreateChildDocument={handleCreateChildDocument}
            onEditRoute={handleEditRoute}
            onToggleRouteEnabled={handleToggleEnabled}
            onDeleteRoute={handleDeleteRoute}
            onEditDocument={handleEditDocument}
            onEditDocumentHierarchical={handleEditDocumentHierarchical}
            onDeleteDocument={handleDeleteDocument}
            onToggleDocumentVisibility={handleToggleDocumentVisibility}
            onToggleDocumentDraft={handleToggleDocumentDraft}
            onReorderSiblings={handleReorderSiblings}
          />
        )}

        {ConfirmDialogComponent}

        {/* Edit Document Modal */}
        {editModalOpen && selectedDocId && (
          <EditDocumentModal
            documentId={selectedDocId}
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedDocId(null);
            }}
          />
        )}

        {/* Hierarchical Document Editor Modal */}
        {hierarchicalEditorOpen && hierarchicalRootId && (
          <HierarchicalDocumentEditor
            rootDocumentId={hierarchicalRootId}
            isOpen={hierarchicalEditorOpen}
            onClose={() => {
              setHierarchicalEditorOpen(false);
              setHierarchicalRootId(null);
            }}
          />
        )}

        {/* Create Document Modal */}
        {createDocModalOpen && (
          <CreateDocumentModal
            isOpen={createDocModalOpen}
            onClose={() => {
              setCreateDocModalOpen(false);
              setSelectedParentDocId(null);
            }}
            type={typeFilter}
            preselectedParentDocId={selectedParentDocId}
            onDocumentCreated={(documentId) => {
              setSelectedDocId(documentId);
              setEditModalOpen(true);
              setCreateDocModalOpen(false);
              setSelectedParentDocId(null);
            }}
          />
        )}

        {/* Edit Route Modal */}
        {editRouteModalOpen && selectedRouteId && (() => {
          // Find route in document tree
          const findRoute = (docs: DocumentWithRoute[], id: string): any => {
            for (const doc of docs) {
              if (doc.route && doc.route._id === id) {
                return {
                  _id: doc.route._id,
                  path: doc.route.path,
                  slug: doc.route.slug,
                  title: doc.route.title,
                  kind: doc.route.kind,
                  enabled: doc.route.enabled,
                  isPublic: doc.route.isPublic,
                  rootDocumentId: doc._id
                };
              }
              const found = findRoute(doc.children, id);
              if (found) return found;
            }
            return null;
          };
          const route = findRoute(data?.data ?? [], selectedRouteId);
          return route ? (
            <EditRouteModal
              isOpen={editRouteModalOpen}
              onClose={() => {
                setEditRouteModalOpen(false);
                setSelectedRouteId(null);
              }}
              routeId={selectedRouteId}
              route={route}
            />
          ) : null;
        })()}
      </div>
    </ManagementLayout>
  );
}
