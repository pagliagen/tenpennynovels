// =============================================================================
// Documents List Component
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  DocumentsListProps, 
  DocumentGroupWithDocuments, 
  Document, 
  DocumentGroup,
  DocumentVisibility,
  CreateDocumentData,
  UpdateDocumentData,
  CreateDocumentGroupData,
  UpdateDocumentGroupData 
} from '@/types';
import { apiRequest, contentAPI } from '@/lib/api';
import { useAuditLogger } from '@/hooks/useAuditLogger';
import { DocumentGroupCard } from './DocumentGroupCard';
import { CreateDocumentModal } from './CreateDocumentModal';
import { CreateGroupModal } from './CreateGroupModal';
import { EditDocumentModal } from './EditDocumentModal';
import { DocumentContentEditor } from './DocumentContentEditor';
import { Modal } from '@/components/shared/Modal';
import styles from '@/styles/components/documents/DocumentsList.module.scss';

interface DocumentsListState {
  groups: DocumentGroupWithDocuments[];
  loading: boolean;
  error: string | null;
  selectedDocument: Document | null;
  selectedGroup: DocumentGroup | null;
  showCreateDocument: boolean;
  showCreateGroup: boolean;
  showEditDocument: boolean;
  showContentEditor: boolean;
  showConfirmDelete: boolean;
  deleteTarget: { type: 'document' | 'group'; id: string; name: string } | null;
}

export function DocumentsList({ type, authContext }: DocumentsListProps) {
  const { logAction } = useAuditLogger();
  
  const [state, setState] = useState<DocumentsListState>({
    groups: [],
    loading: true,
    error: null,
    selectedDocument: null,
    selectedGroup: null,
    showCreateDocument: false,
    showCreateGroup: false,
    showEditDocument: false,
    showContentEditor: false,
    showConfirmDelete: false,
    deleteTarget: null
  });

  // Load documents and groups
  const loadDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await apiRequest<DocumentGroupWithDocuments[]>(
        `/admin/documents/groups?type=${type}`
      );

      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          groups: response.data || [],
          loading: false 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: response.message || 'Errore nel caricamento dei documenti',
          loading: false 
        }));
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Errore di connessione',
        loading: false 
      }));
    }
  }, [type]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handle document creation
  const handleCreateDocument = async (data: CreateDocumentData) => {
    try {
      const response = await apiRequest<Document>('/admin/documents', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          type
        })
      });

      if (response.success) {
        await logAction('document.create', `Nuovo documento: ${data.title}`);
        await loadDocuments();
        setState(prev => ({ ...prev, showCreateDocument: false }));
      } else {
        alert(response.message || 'Errore nella creazione del documento');
      }
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Errore di connessione');
    }
  };

  // Handle group creation
  const handleCreateGroup = async (data: CreateDocumentGroupData) => {
    try {
      const response = await apiRequest<DocumentGroup>('/admin/documents/groups', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          type
        })
      });

      if (response.success) {
        await logAction('document_group.create', `Nuovo gruppo: ${data.name}`);
        await loadDocuments();
        setState(prev => ({ ...prev, showCreateGroup: false }));
      } else {
        alert(response.message || 'Errore nella creazione del gruppo');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Errore di connessione');
    }
  };

  // Handle document update
  const handleUpdateDocument = async (documentId: string, data: UpdateDocumentData) => {
    try {
      const response = await apiRequest<Document>(
        `/admin/documents/${documentId}`, 
        {
          method: 'PUT',
          body: JSON.stringify(data)
        }
      );

      if (response.success) {
        await logAction('document.update', `Modifica documento: ${state.selectedDocument?.title}`);
        await loadDocuments();
        setState(prev => ({ ...prev, showEditDocument: false, selectedDocument: null }));
      } else {
        alert(response.message || 'Errore nell\'aggiornamento del documento');
      }
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Errore di connessione');
    }
  };

  // Handle document content edit
  const handleEditContent = (document: Document) => {
    setState(prev => ({ 
      ...prev, 
      selectedDocument: document,
      showContentEditor: true
    }));
  };

  // Handle document content save
  const handleSaveContent = async (content: string, cssClasses?: any[]) => {
    if (!state.selectedDocument) return;
    
    try {
      const response = await contentAPI.updateDocumentContent(
        state.selectedDocument.id, 
        content, 
        JSON.stringify(cssClasses || [])
      );

      if (response.success) {
        await logAction('document.content_update', `Aggiorna contenuto documento: ${state.selectedDocument?.title}`);
        // Opzionale: ricarica i documenti se necessario
        // await loadDocuments();
      } else {
        throw new Error(response.message || 'Errore nel salvataggio del contenuto');
      }
    } catch (error) {
      console.error('Error saving document content:', error);
      throw error; // Re-throw per gestire nell'editor
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await apiRequest(`/admin/documents/${documentId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        const doc = state.groups
          .flatMap(g => g.documents)
          .find(d => d.id === documentId);
        
        await logAction('document.delete', `Eliminazione documento: ${doc?.title}`);
        await loadDocuments();
        setState(prev => ({ ...prev, showConfirmDelete: false, deleteTarget: null }));
      } else {
        alert(response.message || 'Errore nell\'eliminazione del documento');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Errore di connessione');
    }
  };

  // Handle group deletion
  const handleDeleteGroup = async (groupId: string) => {
    try {
      const response = await apiRequest(`/admin/documents/groups/${groupId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        const group = state.groups.find(g => g.id === groupId);
        await logAction('document_group.delete', `Eliminazione gruppo: ${group?.name}`);
        await loadDocuments();
        setState(prev => ({ ...prev, showConfirmDelete: false, deleteTarget: null }));
      } else {
        alert(response.message || 'Errore nell\'eliminazione del gruppo');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Errore di connessione');
    }
  };

  // Handle visibility toggle
  const handleToggleVisibility = async (documentId: string, visibility: DocumentVisibility) => {
    try {
      const response = await apiRequest<Document>(
        `/admin/documents/${documentId}`, 
        {
          method: 'PUT',
          body: JSON.stringify({ visibility })
        }
      );

      if (response.success) {
        const doc = state.groups
          .flatMap(g => g.documents)
          .find(d => d.id === documentId);
        
        await logAction('document.toggle_visibility', 
          `Visibilità documento "${doc?.title}": ${visibility}`);
        
        // Aggiorna solo lo stato locale invece di ricaricare tutto
        setState(prev => ({
          ...prev,
          groups: prev.groups.map(group => ({
            ...group,
            documents: group.documents.map(doc => 
              doc.id === documentId 
                ? { ...doc, visibility }
                : doc
            )
          }))
        }));
      } else {
        alert(response.message || 'Errore nel cambiamento di visibilità');
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Errore di connessione');
    }
  };

  // Handle group active toggle
  const handleToggleGroupActive = async (groupId: string, isActive: boolean) => {
    try {
      const response = await apiRequest<DocumentGroup>(
        `/admin/documents/groups/${groupId}`, 
        {
          method: 'PUT',
          body: JSON.stringify({ isActive })
        }
      );

      if (response.success) {
        const group = state.groups.find(g => g.id === groupId);
        await logAction('document_group.toggle_active', 
          `Gruppo "${group?.name}" ${isActive ? 'attivato' : 'disattivato'}`);
        
        // Aggiorna solo lo stato locale invece di ricaricare tutto
        setState(prev => ({
          ...prev,
          groups: prev.groups.map(g => 
            g.id === groupId 
              ? { ...g, isActive }
              : g
          )
        }));
      } else {
        alert(response.message || 'Errore nel cambiamento di stato del gruppo');
      }
    } catch (error) {
      console.error('Error toggling group active:', error);
      alert('Errore di connessione');
    }
  };

  // Handle document reorder
  const handleReorderDocuments = async (groupId: string, documentIds: string[]) => {
    try {
      const response = await apiRequest(
        `/admin/documents/groups/${groupId}/reorder`, 
        {
          method: 'PUT',
          body: JSON.stringify({ documentIds })
        }
      );

      if (response.success) {
        await loadDocuments();
      } else {
        alert(response.message || 'Errore nel riordinamento');
        await loadDocuments(); // Reload to restore original order
      }
    } catch (error) {
      console.error('Error reordering documents:', error);
      alert('Errore di connessione');
      await loadDocuments(); // Reload to restore original order
    }
  };

  if (state.loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Caricamento documenti...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={styles.error}>
        <span className={styles.errorIcon}>⚠️</span>
        <p>{state.error}</p>
        <button 
          className={styles.retryButton}
          onClick={loadDocuments}
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className={styles.documentsList}>
      {/* Action Bar */}
      <div className={styles.actionBar}>
        <div className={styles.actionButtons}>
          <button
            className={`${styles.actionButton} ${styles.primary}`}
            onClick={() => setState(prev => ({ ...prev, showCreateGroup: true }))}
            disabled={!authContext.user?.effectivePermissions?.documents?.detail?.create}
          >
            <span className={styles.buttonIcon}>📁</span>
            Nuovo Gruppo
          </button>
          
          <button
            className={`${styles.actionButton} ${styles.secondary}`}
            onClick={() => setState(prev => ({ ...prev, showCreateDocument: true }))}
            disabled={!authContext.user?.effectivePermissions?.documents?.detail?.create || 
                     state.groups.length === 0}
          >
            <span className={styles.buttonIcon}>📄</span>
            Nuovo Documento
          </button>

          <button
            className={`${styles.actionButton} ${styles.ghost}`}
            onClick={loadDocuments}
          >
            <span className={styles.buttonIcon}>🔄</span>
            Aggiorna
          </button>
        </div>

        <div className={styles.stats}>
          <span className={styles.stat}>
            {state.groups.length} {state.groups.length === 1 ? 'gruppo' : 'gruppi'}
          </span>
          <span className={styles.stat}>
            {state.groups.reduce((sum, g) => sum + g.documents.length, 0)} {' '}
            {state.groups.reduce((sum, g) => sum + g.documents.length, 0) === 1 ? 'documento' : 'documenti'}
          </span>
        </div>
      </div>

      {/* Document Groups */}
      {state.groups.length > 0 ? (
        <div className={styles.groupsList}>
          {state.groups.map((group) => (
            <DocumentGroupCard
              key={group.id}
              group={group}
              authContext={authContext}
              onEditDocument={(doc) => setState(prev => ({ 
                ...prev, 
                selectedDocument: doc, 
                showEditDocument: true 
              }))}
              onEditContent={handleEditContent}
              onDeleteDocument={(doc) => setState(prev => ({ 
                ...prev, 
                deleteTarget: { type: 'document', id: doc.id, name: doc.title },
                showConfirmDelete: true 
              }))}
              onDeleteGroup={(group) => {
                // Trova il gruppo completo con i documenti per il logging
                const fullGroup = state.groups.find(g => g.id === group.id);
                console.log('🗑️ onDeleteGroup called:', { 
                  groupId: group.id, 
                  groupName: group.name,
                  documentsCount: fullGroup?.documents.length || 0
                });
                setState(prev => ({ 
                  ...prev, 
                  deleteTarget: { type: 'group', id: group.id, name: group.name },
                  showConfirmDelete: true 
                }));
              }}
              onToggleVisibility={handleToggleVisibility}
              onToggleGroupActive={handleToggleGroupActive}
              onReorderDocuments={handleReorderDocuments}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📚</span>
          <h3>Nessun gruppo presente</h3>
          <p>Crea il primo gruppo di documenti per iniziare</p>
          <button
            className={styles.emptyActionButton}
            onClick={() => setState(prev => ({ ...prev, showCreateGroup: true }))}
            disabled={!authContext.user?.effectivePermissions?.documents?.detail?.create}
          >
            Crea Gruppo
          </button>
        </div>
      )}

      {/* Modals */}
      {state.showCreateGroup && (
        <CreateGroupModal
          isOpen={state.showCreateGroup}
          onClose={() => setState(prev => ({ ...prev, showCreateGroup: false }))}
          onSubmit={handleCreateGroup}
          type={type}
        />
      )}

      {state.showCreateDocument && (
        <CreateDocumentModal
          isOpen={state.showCreateDocument}
          onClose={() => setState(prev => ({ ...prev, showCreateDocument: false }))}
          onSubmit={handleCreateDocument}
          groups={state.groups}
          type={type}
        />
      )}

      {state.showEditDocument && state.selectedDocument && (
        <EditDocumentModal
          isOpen={state.showEditDocument}
          onClose={() => setState(prev => ({ 
            ...prev, 
            showEditDocument: false, 
            selectedDocument: null 
          }))}
          onSubmit={(data) => handleUpdateDocument(state.selectedDocument!.id, data)}
          onSaveContent={handleSaveContent}
          document={state.selectedDocument}
          groups={state.groups}
        />
      )}

      {state.showConfirmDelete && state.deleteTarget && (
        <Modal
          isOpen={state.showConfirmDelete}
          onClose={() => setState(prev => ({ 
            ...prev, 
            showConfirmDelete: false, 
            deleteTarget: null 
          }))}
          title={`Elimina ${state.deleteTarget.type === 'document' ? 'Documento' : 'Gruppo'}`}
          size="medium"
          actions={[
            {
              label: 'Annulla',
              onClick: () => setState(prev => ({ 
                ...prev, 
                showConfirmDelete: false, 
                deleteTarget: null 
              })),
              variant: 'secondary'
            },
            {
              label: 'Elimina',
              onClick: () => {
                if (state.deleteTarget!.type === 'document') {
                  handleDeleteDocument(state.deleteTarget!.id);
                } else {
                  handleDeleteGroup(state.deleteTarget!.id);
                }
              },
              variant: 'danger'
            }
          ]}
        >
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p>
              Sei sicuro di voler eliminare {
                state.deleteTarget.type === 'document' ? 'il documento' : 'il gruppo'
              } <strong>"{state.deleteTarget.name}"</strong>?
            </p>
            {state.deleteTarget.type === 'group' && (
              <p style={{ color: '#ef4444', fontWeight: 'bold' }}>
                Tutti i documenti contenuti verranno eliminati.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Content Editor Modal */}
      {state.showContentEditor && state.selectedDocument && (
        <DocumentContentEditor
          isOpen={state.showContentEditor}
          onClose={() => setState(prev => ({ 
            ...prev, 
            showContentEditor: false, 
            selectedDocument: null 
          }))}
          onSave={handleSaveContent}
          document={state.selectedDocument}
        />
      )}
    </div>
  );
}