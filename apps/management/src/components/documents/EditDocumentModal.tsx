/**
 * Modal for editing document content with TipTap editor
 */
import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { PreviewPanel } from '@/components/shared/PreviewPanel';
import { DocumentContentEditor } from './DocumentContentEditor';
import { DocumentPreview } from './DocumentPreview';
import { useDocument, useUpdateDocument } from '@/hooks/api/useDocuments';
import { useNotificationStore } from '@/store/notificationStore';
import styles from './EditDocumentModal.module.scss';

interface EditDocumentModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  documentId,
  isOpen,
  onClose
}) => {
  const { data: document, isLoading } = useDocument(documentId);
  const [contentDelta, setContentDelta] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const updateDocument = useUpdateDocument();
  const addNotification = useNotificationStore(state => state.addNotification);

  // Initialize state when document loads
  useEffect(() => {
    if (document) {
      setContentDelta(document.contentDelta || { type: 'doc', content: [] });
      setTitle(document.title || '');
      setDescription(document.description || '');
    }
  }, [document]);

  const handleSave = async () => {
    try {
      await updateDocument.mutateAsync({
        id: documentId,
        data: {
          contentDelta,
          title,
          description,
          lastUpdated: new Date().toISOString()
        }
      });

      addNotification({
        type: 'success',
        message: 'Documento salvato con successo'
      });

      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel salvataggio'
      });
    }
  };

  if (isLoading || !contentDelta) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Caricamento..."
        size="large"
      >
        <div className={styles.loading}>Caricamento documento...</div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Modifica Documento"
      size="large"
      footer={
        <>
          <button onClick={onClose} className={styles.cancelButton}>
            Annulla
          </button>
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={updateDocument.isPending}
          >
            {updateDocument.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
        </>
      }
    >
      <div className={styles.modalContent}>
        {/* Preview Button */}
        <div className={styles.toolbar}>
          <button
            onClick={() => setPreviewOpen(true)}
            className={styles.previewButton}
            type="button"
          >
            👁️ Preview
          </button>
        </div>

        {/* Title Input */}
        <div className={styles.titleSection}>
          <label htmlFor="doc-title">Titolo Documento</label>
          <input
            id="doc-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.titleInput}
            placeholder="Inserisci titolo..."
          />
        </div>

        {/* Description Input */}
        <div className={styles.descriptionSection}>
          <label htmlFor="doc-description">Descrizione</label>
          <textarea
            id="doc-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.descriptionInput}
            placeholder="Inserisci descrizione (opzionale)..."
            rows={3}
          />
        </div>

        {/* TipTap Editor */}
        <DocumentContentEditor
          contentDelta={contentDelta}
          onChange={setContentDelta}
        />
      </div>

      {/* Preview Panel */}
      <PreviewPanel
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Document Preview"
        width="large"
      >
        <DocumentPreview
          contentDelta={contentDelta}
          title={title}
        />
      </PreviewPanel>
    </Modal>
  );
};
