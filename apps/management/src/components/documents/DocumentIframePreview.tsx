/**
 * Preview live del documento in un iframe verso apps/documents.
 *
 * Sostituisce il vecchio rendering client-side (DocumentPreview, rimosso): quello
 * sanitizzava l'HTML con una whitelist che escludeva img/table pur essendo
 * entrambi supportati dall'editor, e non replicava affatto l'assemblaggio di
 * hierarchy/TOC della pagina reale. Qui invece si vede la vera pagina (route
 * dedicata /preview/[id], SSR sempre fresca, autorizzata da un token firmato
 * short-lived perché il documento può essere in bozza).
 */
import React, { useEffect, useState } from 'react';
import { API_CONFIG } from '@/constants/config';
import { getDocumentPreviewToken } from '@/lib/api/documents';
import { logger } from '@/lib/logger';
import styles from './DocumentIframePreview.module.scss';

interface DocumentIframePreviewProps {
  documentId: string;
  /** Bump per forzare un reload dopo un autosave */
  refreshSignal: number;
}

export const DocumentIframePreview: React.FC<DocumentIframePreviewProps> = ({
  documentId,
  refreshSignal
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Il vecchio src resta visibile finché non arriva il nuovo (niente flash
    // di loading ad ogni refresh durante la digitazione): error/src si
    // aggiornano solo dagli esiti async, mai in modo sincrono nel corpo dell'effect.
    getDocumentPreviewToken(documentId)
      .then(({ token }) => {
        if (cancelled) return;
        setSrc(`${API_CONFIG.DOCUMENTS_URL}/preview/${documentId}?token=${encodeURIComponent(token)}`);
        setError(null);
      })
      .catch((err) => {
        logger.error('[DocumentIframePreview] Impossibile ottenere il token di preview', { error: err });
        if (!cancelled) setError('Impossibile caricare la preview.');
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, refreshSignal]);

  if (!src && error) {
    return <div className={`${styles.status} ${styles.error}`}>{error}</div>;
  }

  if (!src) {
    return <div className={styles.status}>Caricamento preview...</div>;
  }

  return (
    <div className={styles.wrapper}>
      {error && (
        <div className={`${styles.status} ${styles.error}`}>
          Aggiornamento non riuscito, mostro l&apos;ultima versione disponibile
        </div>
      )}
      <iframe key={src} src={src} title="Anteprima documento" className={styles.iframe} />
    </div>
  );
};
