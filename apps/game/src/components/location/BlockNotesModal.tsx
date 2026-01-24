import React, { useState, useEffect, useRef } from 'react';
import styles from './BlockNotesModal.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface BlockNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string; // Required - notes are location-specific
}

export default function BlockNotesModal({ isOpen, onClose, locationId }: BlockNotesModalProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen, locationId]);

  const loadNotes = async () => {
    if (!locationId) {
      console.error('BlockNotesModal: locationId is required');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/game/block-notes?locationId=${locationId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.data?.notes) {
          setContent(data.data.notes.content || '');
        } else {
          // No notes found for this location yet, start with empty content
          setContent('');
        }
      }
    } catch (error) {
      console.error('Error loading block notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!locationId) {
      console.error('BlockNotesModal: locationId is required to save notes');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/game/block-notes`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          locationId // Always include locationId - notes are location-specific
        })
      });

      if (response.ok) {
        // Notes saved successfully for this location
      } else {
        console.error('Failed to save block notes:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving block notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    
    // Auto-save after 2 seconds of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.title}>📝 Block Notes</h3>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
        </div>

        <div className={styles.modalContent}>
          {isLoading ? (
            <div className={styles.loading}>Caricamento note...</div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className={styles.textarea}
              placeholder="Scrivi le tue note personali per questa location qui..."
            />
          )}
          {isSaving && (
            <div className={styles.savingIndicator}>Salvataggio...</div>
          )}
        </div>
      </div>
    </div>
  );
}

