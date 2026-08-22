/**
 * Document List Page
 *
 * Shows documents as primary tree structure
 * Actions: create/edit/toggle/delete documents
 */

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { DocumentTreeView } from '@/components/documents/DocumentTreeView';
import { EditDocumentModal } from '@/components/documents/EditDocumentModal';
import { HierarchicalDocumentEditor } from '@/components/documents/HierarchicalDocumentEditor';
import { CreateDocumentModal } from '@/components/documents/CreateDocumentModal';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useDocuments,
  useSubtypes,
  useReorderSiblings,
  useDeleteDocument,
  useToggleDocumentVisibility,
  useToggleDocumentDraft
} from '@/hooks/api/useDocuments';
import { useNotificationStore } from '@/store/notificationStore';
import { useURLFilter } from '@/hooks/useURLFilter';
import { setFilterInHash } from '@/lib/utils/urlFilters';
import type { DocumentTreeNode, DocumentType } from '@/types/api/Document';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/types/api/Document';
import styles from '@/styles/pages/DocumentList.module.scss';

export default function DocumentList() {
  const urlFilter = useURLFilter<{ type?: DocumentType }>();
  const typeFilter = urlFilter?.type || 'ambientazione';
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [hierarchicalEditorOpen, setHierarchicalEditorOpen] = useState(false);
  const [hierarchicalRootId, setHierarchicalRootId] = useState<string | null>(null);
  const [createDocModalOpen, setCreateDocModalOpen] = useState(false);
  const [selectedParentDocId, setSelectedParentDocId] = useState<string | null>(null);

  const [activeSubtypeIds, setActiveSubtypeIds] = useState<Set<string> | null>(null);

  const { data, isLoading, error } = useDocuments({ type: typeFilter });
  const { data: subtypes = [] } = useSubtypes(typeFilter);
  const reorderSiblings = useReorderSiblings();
  const deleteDocument = useDeleteDocument();
  const toggleDocumentVisibility = useToggleDocumentVisibility();
  const toggleDocumentDraft = useToggleDocumentDraft();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  useEffect(() => {
    if (!urlFilter?.type) {
      setFilterInHash({ type: 'ambientazione' });
    }
  }, []);

  useEffect(() => {
    setActiveSubtypeIds(null);
  }, [typeFilter]);

  const toggleSubtype = (subtypeId: string) => {
    setActiveSubtypeIds(prev => {
      const current = prev ?? new Set(subtypes.map(s => s._id));
      const next = new Set(current);
      if (next.has(subtypeId)) {
        next.delete(subtypeId);
      } else {
        next.add(subtypeId);
      }
      return next;
    });
  };

  const filteredDocuments = useMemo(() => {
    const docs = data?.data ?? [];
    const active = activeSubtypeIds ?? new Set(subtypes.map(s => s._id));
    if (active.size === subtypes.length) return docs;

    const filterTree = (nodes: DocumentTreeNode[]): DocumentTreeNode[] =>
      nodes
        .filter(node => node.subtype && active.has(node.subtype._id))
        .map(node => ({
          ...node,
          children: filterTree(node.children)
        }));

    return filterTree(docs);
  }, [data?.data, activeSubtypeIds, subtypes]);

  const handleTypeFilterChange = (type: DocumentType) => {
    setFilterInHash({ type });
  };

  const handleCreateChildDocument = (parentDocId: string) => {
    setSelectedParentDocId(parentDocId);
    setCreateDocModalOpen(true);
  };

  const handleReorderSiblings = async (parentId: string | null, orderedIds: string[]) => {
    try {
      await reorderSiblings.mutateAsync({ parentId, orderedIds });
      addNotification({ type: 'success', message: `${orderedIds.length} documenti riordinati` });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel riordinamento'
      });
    }
  };

  const handleEditDocument = (documentId: string) => {
    setSelectedDocId(documentId);
    setEditModalOpen(true);
  };

  const handleEditDocumentHierarchical = (documentId: string) => {
    setHierarchicalRootId(documentId);
    setHierarchicalEditorOpen(true);
  };

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
        <title>Ten Penny Novels | Gestione Documenti</title>
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
              + Crea Documento
            </button>
          </div>
        </header>

        {/* Type Filters */}
        <div className={styles.filters}>
          {DOCUMENT_TYPES.map(type => (
            <button
              key={type}
              className={`${styles.filterButton} ${typeFilter === type ? styles.active : ''}`}
              onClick={() => handleTypeFilterChange(type)}
            >
              {DOCUMENT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Subtype Filters */}
        {subtypes.length > 0 && (
          <div className={styles.subtypeFilters}>
            {subtypes.map(st => {
              const active = activeSubtypeIds ?? new Set(subtypes.map(s => s._id));
              const isActive = active.has(st._id);
              return (
                <button
                  key={st._id}
                  className={`${styles.subtypeButton} ${isActive ? styles.active : ''}`}
                  onClick={() => toggleSubtype(st._id)}
                >
                  {st.title}
                </button>
              );
            })}
          </div>
        )}

        {/* Tree View */}
        {isLoading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : (
          <DocumentTreeView
            documents={filteredDocuments}
            onCreateChildDocument={handleCreateChildDocument}
            onEditDocument={handleEditDocument}
            onEditDocumentHierarchical={handleEditDocumentHierarchical}
            onDeleteDocument={handleDeleteDocument}
            onToggleDocumentVisibility={handleToggleDocumentVisibility}
            onToggleDocumentDraft={handleToggleDocumentDraft}
            onReorderSiblings={handleReorderSiblings}
          />
        )}

        {ConfirmDialogComponent}

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
              setCreateDocModalOpen(false);
              setSelectedParentDocId(null);
              handleEditDocument(documentId);
            }}
          />
        )}
      </div>
    </ManagementLayout>
  );
}
