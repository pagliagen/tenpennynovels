/**
 * CharacterReviewOutcomeModal
 *
 * Interstiziale non dismissibile che mostra l'esito di approvazione/rifiuto
 * del personaggio se il giocatore non era connesso quando è stato deciso
 * (o se semplicemente non l'ha ancora confermato). Guidata da
 * `selectedCharacter.pendingReviewNotification`, popolata da
 * GET /auth/session — vedi GameLayout.tsx per il mount e il trigger.
 *
 * @module components/character/CharacterReviewOutcomeModal
 */

'use client';

import React from 'react';

import { Modal } from '@/components/shared/Modal';
import { useAcknowledgeReview } from '@/hooks/useCharacterReview';
import styles from '@/styles/components/character/CharacterReviewOutcomeModal.module.scss';

interface PendingReviewNotification {
  reviewId: string;
  action: 'approve' | 'reject';
  note?: string;
  reviewedAt: string;
}

interface CharacterReviewOutcomeModalProps {
  characterId: string;
  notification: PendingReviewNotification;
  onAcknowledged: () => void;
}

export function CharacterReviewOutcomeModal({
  characterId,
  notification,
  onAcknowledged
}: CharacterReviewOutcomeModalProps): React.ReactElement {
  const acknowledgeReview = useAcknowledgeReview();

  const handleConfirm = async () => {
    try {
      await acknowledgeReview.mutateAsync({ characterId, reviewId: notification.reviewId });
    } catch {
      // Non-bloccante: se la ack fallisce, la modale ricompare al prossimo
      // refresh sessione — nessun dato viene perso.
    }
    onAcknowledged();
  };

  const isApproved = notification.action === 'approve';

  return (
    <Modal
      isOpen={true}
      onClose={() => {}}
      title="Esito revisione personaggio"
      size="small"
      showCloseButton={false}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      footer={
        <button
          className={styles.primaryButton}
          onClick={handleConfirm}
          disabled={acknowledgeReview.isPending}
        >
          {acknowledgeReview.isPending ? 'Conferma in corso…' : 'Ho capito'}
        </button>
      }
    >
      <div className={styles.body}>
        <p className={`${styles.outcome} ${isApproved ? styles.approved : styles.rejected}`}>
          {isApproved
            ? 'Il tuo personaggio è stato approvato!'
            : 'Il tuo personaggio è stato rifiutato ed è tornato in bozza.'}
        </p>

        {notification.note && (
          <>
            <p className={styles.noteLabel}>
              {isApproved ? 'Nota dello staff' : 'Motivazione'}
            </p>
            <p className={styles.note}>{notification.note}</p>
          </>
        )}
      </div>
    </Modal>
  );
}
