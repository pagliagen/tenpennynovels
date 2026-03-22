/**
 * Force Outcome Modal Component
 *
 * Master-only modal to forcibly resolve a pending confrontation.
 * Allows choosing outcome and defender's success level.
 *
 * @module components/chat/ForceOutcomeModal
 */

'use client';

import { useState } from 'react';

import { locationChatsApi } from '@/lib/api/locationChats';
import styles from '@/styles/components/chat/ForceOutcomeModal.module.scss';

interface ForceOutcomeModalProps {
  messageId: string;
  attackerName: string;
  defenderName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type SuccessLevel = 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';

const SUCCESS_LEVELS: Array<{ value: SuccessLevel; label: string }> = [
  { value: 'critical', label: 'Critico' },
  { value: 'extreme', label: 'Estremo' },
  { value: 'hard', label: 'Difficile' },
  { value: 'normal', label: 'Normale' },
  { value: 'failure', label: 'Fallimento' },
  { value: 'fumble', label: 'Fumble' },
];

export function ForceOutcomeModal({
  messageId,
  attackerName,
  defenderName,
  onClose,
  onSuccess,
}: ForceOutcomeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleForce = async (outcome: 'attacker_wins' | 'defender_wins', defenderSuccessLevel?: SuccessLevel) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await locationChatsApi.forceConfrontationOutcome({
        messageId,
        forcedOutcome: outcome,
        defenderSuccessLevel,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il forzamento dell\'esito');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Forza Esito Contrapposto (Master)</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Chiudi">
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {error && <div className={styles.error}>{error}</div>}

          <p className={styles.subtitle}>Scegli l'esito da applicare:</p>

          <div className={styles.outcomeSection}>
            <button
              onClick={() => handleForce('attacker_wins')}
              disabled={isSubmitting}
              className={styles.outcomeButton}
            >
              {attackerName} vince
            </button>
          </div>

          <div className={styles.outcomeSection}>
            <p className={styles.sectionTitle}>{defenderName} vince con:</p>
            <div className={styles.levelGrid}>
              {SUCCESS_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => handleForce('defender_wins', level.value)}
                  disabled={isSubmitting}
                  className={styles.levelButton}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
