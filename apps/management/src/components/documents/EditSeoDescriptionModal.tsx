/**
 * EditSeoDescriptionModal - Modifica a mano della descrizione SEO di un documento.
 *
 * La descrizione SEO è la meta description della pagina pubblica: i motori di ricerca la mostrano sotto il titolo
 * e la tagliano oltre ~160 caratteri. Titolo e testo del documento si modificano dall'editor del documento.
 */

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { useUpdateSeoDescription } from '@/hooks/api/useDocuments';
import { useNotificationStore } from '@/store/notificationStore';
import type { SeoDocument } from '@/types/api/Document';
import styles from '@/styles/pages/SeoDocuments.module.scss';

/** Lunghezza consigliata (come `apps/documents/src/components/SEO.tsx`): sotto non dice abbastanza, sopra viene tagliata. */
export const SEO_RECOMMENDED_MIN = 120;
export const SEO_RECOMMENDED_MAX = 160;
/** Limite del backend. */
export const SEO_HARD_MAX = 300;

interface Props {
  document: SeoDocument | null;
  onClose: () => void;
}

export function seoLengthHint(length: number): { ok: boolean; text: string } {
  if (length === 0) return { ok: false, text: 'Nessuna descrizione: la pagina userà il testo di default.' };
  if (length < SEO_RECOMMENDED_MIN) return { ok: false, text: `${length} caratteri: un po' corta (consigliati ${SEO_RECOMMENDED_MIN}-${SEO_RECOMMENDED_MAX})` };
  if (length > SEO_RECOMMENDED_MAX) return { ok: false, text: `${length} caratteri: i motori di ricerca la tagliano oltre ${SEO_RECOMMENDED_MAX}` };
  return { ok: true, text: `${length} caratteri` };
}

/** Si rimonta a ogni documento (`key`): il valore iniziale è quello del documento, senza sincronizzazioni con un effect. */
function SeoDescriptionForm({ document, onClose }: { document: SeoDocument; onClose: () => void }): React.ReactElement {
  const update = useUpdateSeoDescription();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [description, setDescription] = useState(document.description);

  const hint = seoLengthHint(description.trim().length);
  const unchanged = description.trim() === document.description.trim();

  const save = async (): Promise<void> => {
    try {
      await update.mutateAsync({ id: document._id, description: description.trim() });
      addNotification({ type: 'success', message: `Descrizione SEO di "${document.title}" salvata` });
      onClose();
    } catch (error) {
      addNotification({ type: 'error', message: error instanceof Error ? error.message : 'Errore nel salvataggio' });
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Descrizione SEO: ${document.title}`}
      size="medium"
      footer={
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Annulla</button>
          <button type="button" className={styles.submitBtn} onClick={save} disabled={update.isPending || unchanged || description.length > SEO_HARD_MAX}>
            {update.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      }
    >
      <FormField
        label="Descrizione SEO"
        name="seo-description"
        type="textarea"
        value={description}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
        placeholder="Di cosa tratta la pagina, in una o due frasi."
      />
      <p className={hint.ok ? styles.hintOk : styles.hintWarn}>{hint.ok ? '✓ ' : '⚠ '}{hint.text}</p>
    </Modal>
  );
}

export function EditSeoDescriptionModal({ document, onClose }: Props): React.ReactElement | null {
  return document ? <SeoDescriptionForm key={document._id} document={document} onClose={onClose} /> : null;
}
