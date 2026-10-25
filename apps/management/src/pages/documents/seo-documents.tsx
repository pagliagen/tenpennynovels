/**
 * SEO Documents Page
 *
 * Elenco di titoli e descrizioni SEO dei documenti pubblici (ConfigurableDataTable + TanStack Query).
 * Azioni per riga:
 * - Modifica: scrive la descrizione a mano (EditSeoDescriptionModal).
 * - Genera SEO: l'AI la scrive dal titolo e dal testo del documento e il backend la salva. Compare solo se
 *   l'AI editoriale è attiva (`featureFlagsStore.editorialAiEnabled`: variabile d'ambiente + gateway raggiungibile).
 */

import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { EditSeoDescriptionModal } from '@/components/documents/EditSeoDescriptionModal';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useSeoDocuments, useGenerateSeoDescription } from '@/hooks/api/useDocuments';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';
import { useNotificationStore } from '@/store/notificationStore';
import type { SeoDocument } from '@/types/api/Document';
import styles from '@/styles/pages/SeoDocuments.module.scss';

interface SeoDocumentsParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function SeoDocumentsPage() {
  const { filters, handleFilterChange } = useTableFilters<SeoDocumentsParams>({
    page: 1,
    pageSize: 50,
    sortBy: 'title',
    sortOrder: 'asc'
  });

  const { data, isLoading, error } = useSeoDocuments();
  const tableConfig = useTableConfig('seo-documents');
  const aiEnabled = useFeatureFlagsStore((s) => s.editorialAiEnabled);
  const generate = useGenerateSeoDescription();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [editing, setEditing] = useState<SeoDocument | null>(null);

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(
      col => tableConfig.columnVisibility[col.key] !== false
    );
  }, [tableConfig.config, tableConfig.columnVisibility]);

  // «Genera SEO» non si offre se l'AI non c'è: niente pulsante che poi risponde 404.
  const config = useMemo(() => {
    if (!tableConfig.config) return null;
    return { ...tableConfig.config, actions: tableConfig.config.actions?.filter((a) => a.key !== 'generate-seo' || aiEnabled) };
  }, [tableConfig.config, aiEnabled]);

  // Client-side filter by type (the TableFilters widget calls onFilterChange)
  const filteredData = useMemo(() => {
    const docs = data?.documents ?? [];
    if (!filters.type) return docs;
    return docs.filter(doc => doc.type === filters.type);
  }, [data?.documents, filters.type]);

  const handleAction = async (action: string, doc: SeoDocument): Promise<void> => {
    if (action === 'edit') {
      setEditing(doc);
      return;
    }
    if (action !== 'generate-seo') return;
    if (generate.isPending) {
      addNotification({ type: 'info', message: 'Una generazione è già in corso: attendi che finisca.' });
      return;
    }
    if (doc.description.trim() !== '') {
      const confirmed = await confirm({
        title: 'Sostituire la descrizione SEO?',
        message: `"${doc.title}" ha già una descrizione SEO. L'AI ne scriverà una nuova e la salverà al suo posto.`,
      });
      if (!confirmed) return;
    }
    try {
      addNotification({ type: 'info', message: `Genero la descrizione SEO di "${doc.title}"…` });
      const result = await generate.mutateAsync({ id: doc._id });
      addNotification({ type: 'success', message: `Descrizione SEO di "${doc.title}" salvata (${result.description.length} caratteri)` });
    } catch (err) {
      addNotification({ type: 'error', message: err instanceof Error ? err.message : 'Generazione non riuscita' });
    }
  };

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento documenti SEO</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | SEO Documenti</title>
      </Head>

      <div className={styles.seoDocuments}>
        <header className={styles.header}>
          <h1>SEO Documenti</h1>
          <p>
            Totale: {data?.documents.length ?? 0} documenti
          </p>
        </header>

        <ConfigurableDataTable<SeoDocument>
          tableName="seo-documents"
          data={filteredData}
          loading={isLoading || tableConfig.loading}
          filters={filters}
          onFilterChange={handleFilterChange}
          onAction={handleAction}
          externalConfig={config ? {
            config,
            visibleColumns: visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue
          } : undefined}
        />

        <EditSeoDescriptionModal document={editing} onClose={() => setEditing(null)} />
        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
