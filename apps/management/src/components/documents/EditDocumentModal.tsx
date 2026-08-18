/**
 * Modal for editing document content with TipTap editor
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/shared/Modal';
import { PreviewPanel } from '@/components/shared/PreviewPanel';
import { DocumentContentEditor } from './DocumentContentEditor';
import { DocumentIframePreview } from './DocumentIframePreview';
import { useDocument, useUpdateDocument, useAutosaveDocument, documentKeys } from '@/hooks/api/useDocuments';
import { useNotificationStore } from '@/store/notificationStore';
import { useConfirm } from '@/hooks/useConfirm';
import styles from './EditDocumentModal.module.scss';

interface EditDocumentModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

/** Debounce dall'ultima digitazione prima di autosalvare (persistenza reale, no re-embed/SEO). */
const AUTOSAVE_DEBOUNCE_MS = 1000;
/** Ulteriore attesa dopo un autosave riuscito prima di ricaricare l'iframe: evita reload/flicker ad ogni tick. */
const PREVIEW_RELOAD_DEBOUNCE_MS = 2000;

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  documentId,
  isOpen,
  onClose
}) => {
  const { data: document, isLoading, isError, error } = useDocument(documentId);
  const [contentDelta, setContentDelta] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const updateDocument = useUpdateDocument();
  const autosaveDocument = useAutosaveDocument();
  const addNotification = useNotificationStore(state => state.addNotification);
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialogComponent } = useConfirm();

  // Stato più recente per i callback dei timer (evita closure su valori stantii).
  // Aggiornato in un effect (mai durante il render) e comunque letto solo ~1s
  // dopo, quando il debounce scatta: l'effect ha sempre già girato per allora.
  const latestRef = useRef({ title, contentDelta });
  useEffect(() => {
    latestRef.current = { title, contentDelta };
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mutex condiviso tra autosave e "Salva" esplicito: evita che una risposta
  // HTTP fuori ordine faccia sovrascrivere in DB un salvataggio più recente.
  const savingRef = useRef<Promise<unknown> | null>(null);
  // Snapshot di title/contentDelta al momento dell'apertura: l'autosave scrive
  // per davvero sul documento (serve al preview live), quindi "Annulla" deve
  // ripristinare esplicitamente questi valori, non limitarsi a non salvare.
  const originalSnapshotRef = useRef<{ title: string; contentDelta: any } | null>(null);
  // true se almeno un autosave è andato a buon fine in questa sessione di
  // editing: solo allora "Annulla" deve chiedere conferma e fare il revert.
  const hasAutosavedRef = useRef(false);

  // Initialize state when document loads
  useEffect(() => {
    if (document) {
      const initialContentDelta = document.contentDelta || { type: 'doc', content: [] };
      const initialTitle = document.title || '';
      setContentDelta(initialContentDelta);
      setTitle(initialTitle);
      originalSnapshotRef.current = { title: initialTitle, contentDelta: initialContentDelta };
      hasAutosavedRef.current = false;
    }
  }, [document]);

  const clearDebounceTimer = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      setRefreshSignal((s) => s + 1);
    }, PREVIEW_RELOAD_DEBOUNCE_MS);
  }, []);

  const runAutosave = useCallback(async (): Promise<void> => {
    // Già un salvataggio in corso (autosave o "Salva"): salta questo giro,
    // la prossima digitazione ripianificherà un autosave.
    if (savingRef.current) return;

    const { title: currentTitle, contentDelta: currentDelta } = latestRef.current;
    const promise = autosaveDocument
      .mutateAsync({ id: documentId, data: { title: currentTitle, contentDelta: currentDelta } })
      .then(() => {
        hasAutosavedRef.current = true;
        scheduleReload();
      })
      .catch((err) => {
        // Autosave silenzioso: nessun toast ad ogni tick, solo log. Il
        // prossimo giro di digitazione (o "Salva") ritenterà comunque.
        addNotification({ type: 'error', message: 'Autosave non riuscito, verrà ritentato' });
        throw err;
      })
      .finally(() => {
        savingRef.current = null;
      });

    savingRef.current = promise;
    await promise.catch(() => {});
  }, [autosaveDocument, documentId, scheduleReload, addNotification]);

  const scheduleAutosave = useCallback(() => {
    clearDebounceTimer();
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [runAutosave]);

  // Cleanup timer allo smontaggio (chiusura modal)
  useEffect(() => {
    return () => {
      clearDebounceTimer();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  const handleContentChange = (delta: any) => {
    setContentDelta(delta);
    scheduleAutosave();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleAutosave();
  };

  const handleSave = async () => {
    try {
      // Cancella un autosave pendente e attende uno già in volo, così "Salva"
      // è sempre l'ultima scrittura (mai sovrascritto da un autosave in ritardo).
      clearDebounceTimer();
      if (savingRef.current) await savingRef.current.catch(() => {});

      const promise = updateDocument.mutateAsync({
        id: documentId,
        data: {
          contentDelta,
          title,
          lastUpdated: new Date().toISOString()
        }
      });
      savingRef.current = promise.finally(() => { savingRef.current = null; });
      savingRef.current.catch(() => {}); // l'errore vero è gestito sotto via `await promise`
      await promise;

      addNotification({
        type: 'success',
        message: 'Documento salvato con successo'
      });

      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel salvataggio'
      });
    }
  };

  const handleCancel = async () => {
    // Annulla scarta TUTTO, inclusa l'ultima digitazione non ancora
    // autosalvata: niente flush qui, a differenza di una semplice chiusura.
    clearDebounceTimer();

    // Aspetta un eventuale autosave già in volo prima di decidere se serve
    // un revert, altrimenti rischiamo di valutare hasAutosavedRef troppo presto.
    if (savingRef.current) await savingRef.current.catch(() => {});

    if (hasAutosavedRef.current && originalSnapshotRef.current) {
      const confirmed = await confirm({
        title: 'Annullare le modifiche?',
        message: 'Le modifiche digitate finora sono già state salvate automaticamente (servono al preview live). Annullando, il documento torna alla versione precedente all\'apertura.',
        confirmLabel: 'Annulla modifiche',
        cancelLabel: 'Continua a modificare',
        type: 'danger'
      });

      if (!confirmed) return;

      const { title: originalTitle, contentDelta: originalDelta } = originalSnapshotRef.current;
      const revertPromise = autosaveDocument.mutateAsync({
        id: documentId,
        data: { title: originalTitle, contentDelta: originalDelta }
      });
      savingRef.current = revertPromise.finally(() => { savingRef.current = null; });
      savingRef.current.catch(() => {});

      try {
        await revertPromise;
      } catch {
        // Non chiudere: se il revert fallisce il documento resterebbe con le
        // modifiche autosalvate mentre l'utente crede di averle annullate.
        addNotification({ type: 'error', message: 'Impossibile ripristinare la versione precedente, riprova' });
        return;
      }
    }

    // useAutosaveDocument non invalida mai la cache di useDocument (apposta,
    // per non resettare l'editor mentre l'utente digita): farlo qui, alla
    // chiusura, altrimenti riaprendo si rivede una versione stale.
    queryClient.invalidateQueries({ queryKey: documentKeys.detail(documentId) });
    queryClient.invalidateQueries({ queryKey: documentKeys.lists() });

    onClose();
  };

  if (isLoading || (!contentDelta && !isError)) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Caricamento..."
        size="large"
      >
        <div className={styles.loading}>Caricamento documento...</div>
      </Modal>
    );
  }

  if (isError || !document) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Errore"
        size="large"
      >
        <div className={styles.loading}>
          Impossibile caricare il documento: {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Modifica Documento"
      size="large"
      footer={
        <>
          <button onClick={handleCancel} className={styles.cancelButton}>
            Annulla
          </button>
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={updateDocument.isPending}
          >
            {updateDocument.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
        </>
      }
    >
      <div className={styles.modalContent}>
        {/* Preview Button */}
        <div className={styles.toolbar}>
          <button
            onClick={() => setPreviewOpen(true)}
            className={styles.previewButton}
            type="button"
          >
            👁️ Preview
          </button>
        </div>

        {/* Title Input */}
        <div className={styles.titleSection}>
          <label htmlFor="doc-title">Titolo Documento</label>
          <input
            id="doc-title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            className={styles.titleInput}
            placeholder="Inserisci titolo..."
          />
        </div>

        {/* TipTap Editor */}
        <DocumentContentEditor
          contentDelta={contentDelta}
          onChange={handleContentChange}
        />
      </div>

      {/* Preview Panel */}
      <PreviewPanel
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Document Preview"
        width="large"
      >
        <DocumentIframePreview documentId={documentId} refreshSignal={refreshSignal} />
      </PreviewPanel>

      {ConfirmDialogComponent}
    </Modal>
  );
};
