import React, { useState } from 'react';
import styles from './MasterOutcomeModal.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface MasterOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  characterId: string;
  availableCharacters: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

export default function MasterOutcomeModal({
  isOpen,
  onClose,
  locationId,
  characterId,
  availableCharacters,
  onSuccess
}: MasterOutcomeModalProps) {
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'master_only' | 'whisper'>('whisper');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCharacterToggle = (charId: string) => {
    setSelectedCharacters(prev => {
      if (prev.includes(charId)) {
        return prev.filter(id => id !== charId);
      } else {
        return [...prev, charId];
      }
    });
  };

  const handleSend = async () => {
    if (!content.trim()) {
      setError('Il contenuto non può essere vuoto');
      return;
    }

    if (visibility === 'whisper' && selectedCharacters.length === 0) {
      setError('Seleziona almeno un destinatario per il sussurro');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const actionData: any = {
        actionType: visibility === 'master_only' ? 'master' : 'whisper',
        content: content.trim(),
        locationId,
        visibility,
        tags: []
      };

      if (visibility === 'whisper' && selectedCharacters.length > 0) {
        actionData.targetCharacters = selectedCharacters;
      }

      const response = await fetch(`${API_BASE}/game/locations/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(actionData)
      });

      if (response.ok) {
        setContent('');
        setSelectedCharacters([]);
        setVisibility('whisper');
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Errore durante l\'invio');
      }
    } catch (err) {
      setError('Errore di connessione');
      console.error('Error sending master outcome:', err);
    } finally {
      setIsSending(false);
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
          <h3 className={styles.title}>📨 Esito Riservato</h3>
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
            <label className={styles.label}>Tipo di visibilità:</label>
            <select
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value as 'master_only' | 'whisper');
                if (e.target.value === 'master_only') {
                  setSelectedCharacters([]);
                }
              }}
              className={styles.select}
            >
              <option value="whisper">Sussurro (visibile solo ai destinatari)</option>
              <option value="master_only">Solo Master (visibile solo ai master)</option>
            </select>
          </div>

          {visibility === 'whisper' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Destinatari:</label>
              <div className={styles.characterList}>
                {availableCharacters
                  .filter(char => char.id !== characterId)
                  .map(char => (
                    <label key={char.id} className={styles.characterCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedCharacters.includes(char.id)}
                        onChange={() => handleCharacterToggle(char.id)}
                      />
                      <span>{char.name}</span>
                    </label>
                  ))}
              </div>
              {selectedCharacters.length === 0 && (
                <div className={styles.warning}>
                  Seleziona almeno un destinatario
                </div>
              )}
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Contenuto:</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={styles.textarea}
              rows={8}
              placeholder="Scrivi l'esito riservato..."
            />
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSending}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSend}
              className={styles.sendButton}
              disabled={isSending || !content.trim() || (visibility === 'whisper' && selectedCharacters.length === 0)}
            >
              {isSending ? 'Invio...' : 'Invia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

