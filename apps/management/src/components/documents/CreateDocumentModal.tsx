// =============================================================================
// Create Document Modal Component  
// =============================================================================

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { CreateDocumentData, DocumentType, DocumentVisibility, DocumentGroupWithDocuments } from '@/types';
import styles from '@/styles/components/documents/CreateDocumentModal.module.scss';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDocumentData) => Promise<void>;
  groups: DocumentGroupWithDocuments[];
  type: DocumentType;
}

export function CreateDocumentModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  groups,
  type 
}: CreateDocumentModalProps) {
  const [formData, setFormData] = useState<CreateDocumentData>({
    title: '',
    content: '',
    groupId: '',
    type,
    visibility: 'pubblico',
    status: 'draft',
    summary: '',
    tags: []
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof CreateDocumentData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Il titolo deve essere di almeno 3 caratteri';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Il titolo non può superare i 200 caratteri';
    }

    if (!formData.groupId) {
      newErrors.groupId = 'Seleziona un gruppo per il documento';
    }

    if (formData.summary && formData.summary.length > 500) {
      newErrors.summary = 'Il riassunto non può superare i 500 caratteri';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Il contenuto è obbligatorio';
    } else if (formData.content.length < 10) {
      newErrors.content = 'Il contenuto deve essere di almeno 10 caratteri';
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
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      content: '',
      groupId: '',
      type,
      visibility: 'pubblico',
      status: 'draft',
      summary: '',
      tags: []
    });
    setErrors({});
    setLoading(false);
    onClose();
  };

  const getVisibilityIcon = (visibility: DocumentVisibility) => {
    switch (visibility) {
      case 'pubblico': return '🌍';
      case 'ristretto': return '🔒';
      case 'spento': return '🚫';
      default: return '❓';
    }
  };

  const getTypeLabel = (docType: DocumentType) => {
    return docType === 'ambientazione' ? 'Ambientazione' : 'Regolamento';
  };

  const activeGroups = groups.filter(g => g.isActive);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nuovo Documento"
      size="large"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formSection}>
          <div className={styles.typeInfo}>
            <span className={styles.typeIcon}>
              {type === 'ambientazione' ? '🌍' : '📜'}
            </span>
            <span className={styles.typeLabel}>
              Tipo: {getTypeLabel(type)}
            </span>
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
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Inserisci il titolo del documento..."
              maxLength={200}
              disabled={loading}
            />
            {errors.title && (
              <span className={styles.errorText}>{errors.title}</span>
            )}
            <div className={styles.charCount}>
              {formData.title.length}/200
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="documentGroup">
              Gruppo *
            </label>
            <select
              id="documentGroup"
              className={`${styles.select} ${errors.groupId ? styles.error : ''}`}
              value={formData.groupId}
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
            {activeGroups.length === 0 && (
              <span className={styles.warningText}>
                ⚠️ Nessun gruppo attivo disponibile. Crea prima un gruppo.
              </span>
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
            value={formData.summary}
            onChange={(e) => handleInputChange('summary', e.target.value || '')}
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
              value={formData.visibility}
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
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              disabled={loading}
            >
              <option value="draft">📝 Bozza</option>
              <option value="published">✅ Pubblicato</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="documentContent">
            Contenuto *
          </label>
          <textarea
            id="documentContent"
            className={`${styles.textarea} ${styles.contentArea} ${errors.content ? styles.error : ''}`}
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            placeholder="Inserisci il contenuto del documento in formato Markdown..."
            rows={10}
            disabled={loading}
          />
          {errors.content && (
            <span className={styles.errorText}>{errors.content}</span>
          )}
          <div className={styles.helpText}>
            💡 Supporta la sintassi Markdown per formattazione avanzata
          </div>
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
            disabled={loading || activeGroups.length === 0}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Creando...
              </>
            ) : (
              <>
                <span>📄</span>
                Crea Documento
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}