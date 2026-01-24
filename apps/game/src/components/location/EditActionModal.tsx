import React, { useState, useEffect } from 'react';
import styles from './EditActionModal.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface EditActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
  currentContent: string;
  editHistory?: Array<{
    content: string;
    editedAt: Date | string;
    editedBy: string;
  }>;
  isMaster: boolean;
  onSuccess: () => void;
}

export default function EditActionModal({
  isOpen,
  onClose,
  actionId,
  currentContent,
  editHistory = [],
  isMaster,
  onSuccess
}: EditActionModalProps) {
  const [editedContent, setEditedContent] = useState(currentContent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEditedContent(currentContent);
      setError(null);
    }
  }, [isOpen, currentContent]);

  const handleSave = async () => {
    if (!editedContent.trim()) {
      setError('Il contenuto non può essere vuoto');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/game/locations/actions/${actionId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: editedContent.trim()
        })
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Errore durante il salvataggio');
      }
    } catch (err) {
      setError('Errore di connessione');
      console.error('Error updating action:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.title}>✏️ Modifica Azione</h3>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Contenuto:</label>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className={styles.textarea}
              rows={8}
              placeholder="Modifica il contenuto dell'azione..."
            />
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          {editHistory.length > 0 && (
            <div className={styles.editHistory}>
              <h4 className={styles.historyTitle}>Storico Modifiche:</h4>
              <div className={styles.historyList}>
                {editHistory.map((edit, index) => (
                  <div key={index} className={styles.historyItem}>
                    <div className={styles.historyHeader}>
                      <span className={styles.historyBy}>{edit.editedBy}</span>
                      <span className={styles.historyDate}>
                        {new Date(edit.editedAt).toLocaleString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className={styles.historyContent}>{edit.content}</div>
                  </div>
                ))}
                <div className={styles.historyItem}>
                  <div className={styles.historyHeader}>
                    <span className={styles.historyBy}>Versione originale</span>
                    <span className={styles.historyDate}>Prima modifica</span>
                  </div>
                  <div className={styles.historyContent}>{currentContent}</div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={styles.saveButton}
              disabled={isSaving || !editedContent.trim()}
            >
              {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

