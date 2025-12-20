// =============================================================================
// Edit Document Modal Component
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { DocumentContentEditor } from './DocumentContentEditor';
import { UpdateDocumentData, Document, DocumentVisibility, DocumentGroupWithDocuments } from '@/types';
import styles from '@/styles/components/documents/EditDocumentModal.module.scss';

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UpdateDocumentData) => Promise<void>;
  onSaveContent?: (content: string, cssClasses?: any[]) => Promise<void>;
  document: Document;
  groups: DocumentGroupWithDocuments[];
}

export function EditDocumentModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onSaveContent,
  document,
  groups 
}: EditDocumentModalProps) {
  const [formData, setFormData] = useState<UpdateDocumentData>({
    title: document.title,
    groupId: document.groupId,
    visibility: document.visibility,
    status: document.status,
    summary: document.summary || ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showContentEditor, setShowContentEditor] = useState(false);

  // Update form data when document changes
  useEffect(() => {
    if (document) {
      setFormData({
        title: document.title,
        groupId: document.groupId,
        visibility: document.visibility,
        status: document.status,
        summary: document.summary || ''
      });
    }
  }, [document]);

  const handleInputChange = (field: keyof UpdateDocumentData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.title !== undefined) {
      if (!formData.title.trim()) {
        newErrors.title = 'Il titolo è obbligatorio';
      } else if (formData.title.length < 3) {
        newErrors.title = 'Il titolo deve essere di almeno 3 caratteri';
      } else if (formData.title.length > 200) {
        newErrors.title = 'Il titolo non può superare i 200 caratteri';
      }
    }

    if (formData.groupId !== undefined && !formData.groupId) {
      newErrors.groupId = 'Seleziona un gruppo per il documento';
    }

    if (formData.summary !== undefined && formData.summary && formData.summary.length > 500) {
      newErrors.summary = 'Il riassunto non può superare i 500 caratteri';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      // Only send fields that have actually changed
      const changedData: UpdateDocumentData = {};
      
      if (formData.title !== document.title) {
        changedData.title = formData.title;
      }
      if (formData.groupId !== document.groupId) {
        changedData.groupId = formData.groupId;
      }
      if (formData.visibility !== document.visibility) {
        changedData.visibility = formData.visibility;
      }
      if (formData.status !== document.status) {
        changedData.status = formData.status;
      }
      if (formData.summary !== (document.summary || '')) {
        changedData.summary = formData.summary;
      }

      if (Object.keys(changedData).length > 0) {
        await onSubmit(changedData);
      }
      handleClose();
    } catch (error) {
      console.error('Error updating document:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setLoading(false);
    setShowContentEditor(false);
    onClose();
  };

  const handleSaveContent = async (content: string, cssClasses?: any[]) => {
    if (!onSaveContent) {
      console.error('onSaveContent handler not provided');
      return;
    }
    
    try {
      await onSaveContent(content, cssClasses);
    } catch (error) {
      console.error('Error saving document content:', error);
      throw error; // Re-throw per gestire l'errore nel DocumentContentEditor
    }
  };

  const getVisibilityIcon = (visibility: DocumentVisibility) => {
    switch (visibility) {
      case 'pubblico': return '🌍';
      case 'ristretto': return '🔒';
      case 'spento': return '🚫';
      default: return '❓';
    }
  };

  const getTypeLabel = (docType: string) => {
    return docType === 'ambientazione' ? 'Ambientazione' : 'Regolamento';
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const activeGroups = groups.filter(g => g.isActive);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Modifica Documento"
      size="large"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.documentInfo}>
          <div className={styles.typeInfo}>
            <span className={styles.typeIcon}>
              {document.type === 'ambientazione' ? '🌍' : '📜'}
            </span>
            <span className={styles.typeLabel}>
              {getTypeLabel(document.type)}
            </span>
          </div>
          
          <div className={styles.metadata}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Creato:</span>
              <span className={styles.metaValue}>{formatDate(document.createdAt)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Ultima modifica:</span>
              <span className={styles.metaValue}>{formatDate(document.updatedAt)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Versione:</span>
              <span className={styles.metaValue}>v{document.version}</span>
            </div>
            {document.lastEditedBy && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Modificato da:</span>
                <span className={styles.metaValue}>{document.lastEditedBy}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="documentTitle">
              Titolo Documento *
            </label>
            <input
              id="documentTitle"
              type="text"
              className={`${styles.input} ${errors.title ? styles.error : ''}`}
              value={formData.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Inserisci il titolo del documento..."
              maxLength={200}
              disabled={loading}
            />
            {errors.title && (
              <span className={styles.errorText}>{errors.title}</span>
            )}
            <div className={styles.charCount}>
              {(formData.title || '').length}/200
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="documentGroup">
              Gruppo *
            </label>
            <select
              id="documentGroup"
              className={`${styles.select} ${errors.groupId ? styles.error : ''}`}
              value={formData.groupId || ''}
              onChange={(e) => handleInputChange('groupId', e.target.value)}
              disabled={loading}
            >
              <option value="">Seleziona un gruppo...</option>
              {activeGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.documents.length} documenti)
                </option>
              ))}
            </select>
            {errors.groupId && (
              <span className={styles.errorText}>{errors.groupId}</span>
            )}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="documentSummary">
            Riassunto
          </label>
          <textarea
            id="documentSummary"
            className={`${styles.textarea} ${errors.summary ? styles.error : ''}`}
            value={formData.summary || ''}
            onChange={(e) => handleInputChange('summary', e.target.value)}
            placeholder="Breve riassunto del contenuto del documento..."
            rows={2}
            maxLength={500}
            disabled={loading}
          />
          {errors.summary && (
            <span className={styles.errorText}>{errors.summary}</span>
          )}
          <div className={styles.charCount}>
            {(formData.summary || '').length}/500
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="documentVisibility">
              Visibilità
            </label>
            <select
              id="documentVisibility"
              className={styles.select}
              value={formData.visibility || document.visibility}
              onChange={(e) => handleInputChange('visibility', e.target.value as DocumentVisibility)}
              disabled={loading}
            >
              <option value="pubblico">
                🌍 Pubblico - Visibile a tutti
              </option>
              <option value="ristretto">
                🔒 Riservato - Solo utenti registrati
              </option>
              <option value="spento">
                🚫 Nascosto - Non visibile
              </option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="documentStatus">
              Stato
            </label>
            <select
              id="documentStatus"
              className={styles.select}
              value={formData.status || document.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              disabled={loading}
            >
              <option value="draft">📝 Bozza</option>
              <option value="published">✅ Pubblicato</option>
              <option value="archived">📦 Archiviato</option>
            </select>
          </div>
        </div>

        <div className={styles.contentSection}>
          <div className={styles.contentNote}>
            <div className={styles.noteIcon}>📝</div>
            <div className={styles.noteText}>
              <strong>Editor Contenuto</strong><br />
              Modifica il contenuto HTML e CSS del documento con l'editor avanzato.
            </div>
          </div>
          <button
            type="button"
            className={`${styles.button} ${styles.contentButton}`}
            onClick={() => setShowContentEditor(true)}
            disabled={loading}
          >
            <span>🎨</span>
            Modifica Contenuto
          </button>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            onClick={handleClose}
            disabled={loading}
          >
            Annulla
          </button>
          
          <button
            type="submit"
            className={`${styles.button} ${styles.primary}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Salvando...
              </>
            ) : (
              <>
                <span>💾</span>
                Salva Modifiche
              </>
            )}
          </button>
        </div>
      </form>

      {/* Content Editor Modal */}
      {showContentEditor && (
        <DocumentContentEditor
          isOpen={showContentEditor}
          onClose={() => setShowContentEditor(false)}
          onSave={handleSaveContent}
          document={document}
        />
      )}
    </Modal>
  );
}