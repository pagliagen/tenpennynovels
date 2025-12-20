// =============================================================================
// Documents Management - Regolamento Page
// =============================================================================

import React from 'react';
import { ManagementLayout } from '@/components/ManagementLayout';
import { DocumentsList } from '@/components/documents/DocumentsList';
import { DocumentType, AuthContext } from '@/types';
import styles from '@/styles/pages/Documents.module.scss';

interface RegolamentoPageProps {
  authContext: AuthContext;
}

export default function RegolamentoPage({ authContext }: RegolamentoPageProps) {
  const documentType: DocumentType = 'regolamento';

  return (
    <ManagementLayout authContext={authContext}>
      <div className={styles.documentsPage}>
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>
              <span className={styles.icon}>📜</span>
              Gestione Regolamento
            </h1>
            <p className={styles.subtitle}>
              Gestisci le regole e le meccaniche di gioco del sistema Call of Cthulhu Vittoriano
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

