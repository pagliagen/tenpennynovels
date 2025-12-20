// =============================================================================
// Documents Management - Ambientazione Page
// =============================================================================

import React from 'react';
import { ManagementLayout } from '@/components/ManagementLayout';
import { DocumentsList } from '@/components/documents/DocumentsList';
import { DocumentType, AuthContext } from '@/types';
import styles from '@/styles/pages/Documents.module.scss';

interface AmbientazionePageProps {
  authContext: AuthContext;
}

export default function AmbientazionePage({ authContext }: AmbientazionePageProps) {
  const documentType: DocumentType = 'ambientazione';

  return (
    <ManagementLayout authContext={authContext}>
      <div className={styles.documentsPage}>
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>
              <span className={styles.icon}>🌍</span>
              Gestione Ambientazione
            </h1>
            <p className={styles.subtitle}>
              Gestisci i documenti di ambientazione della Londra Vittoriana del 1885
            </p>
          </div>
        </header>

        <div className={styles.content}>
          <DocumentsList 
            type={documentType}
            authContext={authContext}
          />
        </div>
      </div>
    </ManagementLayout>
  );
}

