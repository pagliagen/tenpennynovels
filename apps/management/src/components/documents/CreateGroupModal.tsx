// =============================================================================
// Create Document Group Modal Component
// =============================================================================

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { CreateDocumentGroupData, DocumentType } from '@/types';
import styles from '@/styles/components/documents/CreateGroupModal.module.scss';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDocumentGroupData) => Promise<void>;
  type: DocumentType;
}

export function CreateGroupModal({ isOpen, onClose, onSubmit, type }: CreateGroupModalProps) {
  const [formData, setFormData] = useState<CreateDocumentGroupData>({
    name: '',
    description: '',
    type,
    order: 0,
    isActive: true
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof CreateDocumentGroupData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Il nome del gruppo è obbligatorio';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Il nome deve essere di almeno 3 caratteri';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Il nome non può superare i 100 caratteri';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'La descrizione non può superare i 500 caratteri';
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
      console.error('Error creating group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      type,
      order: 0,
      isActive: true
    });
    setErrors({});
    setLoading(false);
    onClose();
  };

  const getTypeLabel = (docType: DocumentType) => {
    return docType === 'ambientazione' ? 'Ambientazione' : 'Regolamento';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nuovo Gruppo di Documenti"
      size="medium"
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

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="groupName">
            Nome Gruppo *
          </label>
          <input
            id="groupName"
            type="text"
            className={`${styles.input} ${errors.name ? styles.error : ''}`}
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder={type === 'ambientazione' ? 'es. Approfondimenti, Introduzione...' : 'es. Regole Base, Combattimento...'}
            maxLength={100}
            disabled={loading}
          />
          {errors.name && (
            <span className={styles.errorText}>{errors.name}</span>
          )}
          <div className={styles.charCount}>
            {formData.name.length}/100
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="groupDescription">
            Descrizione
          </label>
          <textarea
            id="groupDescription"
            className={`${styles.textarea} ${errors.description ? styles.error : ''}`}
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Descrizione opzionale del gruppo..."
            rows={3}
            maxLength={500}
            disabled={loading}
          />
          {errors.description && (
            <span className={styles.errorText}>{errors.description}</span>
          )}
          <div className={styles.charCount}>
            {(formData.description || '').length}/500
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              disabled={loading}
            />
            <span className={styles.checkboxText}>
              Gruppo attivo (visibile nella pagina documenti)
            </span>
          </label>
          <p className={styles.helpText}>
            I gruppi inattivi non vengono mostrati agli utenti ma i documenti rimangono accessibili
          </p>
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
                Creando...
              </>
            ) : (
              <>
                <span>📁</span>
                Crea Gruppo
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}