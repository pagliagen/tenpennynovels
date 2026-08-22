'use client';

/**
 * Gate di visualizzazione del Manuale Master.
 *
 * NON è un controllo di sicurezza: il backend rifiuta comunque le richieste
 * senza permesso (403 su dettaglio, tipo escluso da liste e ricerca). Serve a
 * distinguere i tre motivi per cui un utente può non vedere il manuale, che
 * altrimenti collasserebbero tutti in un errore generico:
 *
 * 1. non autenticato
 * 2. autenticato ma senza sessione personaggio IN QUESTO TAB — il caso più
 *    frequente e il meno intuitivo: il ruolo master vive sul personaggio e il
 *    sessionId sta in sessionStorage (per-tab), popolato solo dal link nel
 *    gioco. Chi apre documenti.tenpennynovels.com direttamente, o in un tab
 *    nuovo, non ce l'ha — anche se è master a tutti gli effetti.
 * 3. sessione personaggio presente ma senza il permesso
 *
 * @module components/documents/MasterManualGate
 */

import { ReactNode } from 'react';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuthStore, selectCanReadMasterManual } from '@/store/authStore';

const TITLE = 'Ten Penny Novels | Manuale Master';

interface MasterManualGateProps {
  children: ReactNode;
}

/** Legge il sessionId senza far esplodere il render se sessionStorage è inaccessibile. */
function hasCharacterSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!sessionStorage.getItem('character_session_id');
  } catch {
    return false;
  }
}

export function MasterManualGate({ children }: MasterManualGateProps): JSX.Element {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canRead = useAuthStore(selectCanReadMasterManual);

  if (!isInitialized) {
    return <LoadingSpinner fullPage message="Verifica dei permessi..." />;
  }

  if (canRead) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <ErrorMessage
        fullPage
        title={TITLE}
        message="Questa sezione è riservata ai master. Accedi con il tuo account per consultarla."
      />
    );
  }

  if (!hasCharacterSession()) {
    return (
      <ErrorMessage
        fullPage
        title={TITLE}
        message="Il Manuale Master richiede una sessione di gioco attiva. Apri i Documenti dal link nel gioco: il permesso dipende dal personaggio selezionato, non solo dall'account."
      />
    );
  }

  return (
    <ErrorMessage
      fullPage
      title={TITLE}
      message="Il personaggio selezionato non ha il ruolo di master."
    />
  );
}
