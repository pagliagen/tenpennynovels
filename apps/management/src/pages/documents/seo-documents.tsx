/**
 * SEO Documents Page
 *
 * Gestione SEO documenti con ConfigurableDataTable, ContextMenu e TanStack Query.
 */

import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { ContextMenu, ContextMenuItem } from '@/components/shared/ContextMenu';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useSeoDocuments, useRegenerateSeoDescription } from '@/hooks/api/useDocuments';
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

  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading, error } = useSeoDocuments();
  const tableConfig = useTableConfig('seo-documents');
  const regenerateSeo = useRegenerateSeoDescription();
  const addNotification = useNotificationStore(state => state.addNotification);

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(
      col => tableConfig.columnVisibility[col.key] !== false
    );
  }, [tableConfig.config, tableConfig.columnVisibility]);

  // Client-side filter by type (the TableFilters widget calls onFilterChange)
  const filteredData = useMemo(() => {
    const docs = data?.documents ?? [];
    if (!filters.type) return docs;
    return docs.filter(doc => (doc as Record<string, unknown>).type === filters.type);
  }, [data?.documents, filters.type]);

  const aiGatewayEnabled = data?.aiGatewayEnabled ?? false;

  const getMenuItems = (doc: SeoDocument): ContextMenuItem[] => [
    {
      key: 'regenerate-seo',
      label: pendingId === doc._id ? 'Rigenerazione...' : 'Rigenera SEO',
      icon: '🤖',
      disabled: !aiGatewayEnabled || pendingId !== null,
      onClick: () => handleAction('regenerate-seo', doc)
    }
  ];

  const handleAction = async (action: string, doc: SeoDocument) => {
    if (action !== 'regenerate-seo') return;

    try {
      setPendingId(doc._id);
      await regenerateSeo.mutateAsync(doc._id);
      addNotification({ type: 'success', message: `Descrizione SEO aggiornata per "${doc.title}"` });
    } catch (err) {
      addNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore nella rigenerazione'
      });
    } finally {
      setPendingId(null);
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
            {!aiGatewayEnabled && (
              <span className={styles.gatewayWarning}> · AI Gateway non attivo</span>
            )}
          </p>
        </header>

        <ConfigurableDataTable<SeoDocument>
          tableName="seo-documents"
          data={filteredData}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          renderActions={(doc) => (
            <ContextMenu
              items={getMenuItems(doc)}
              position="left"
              ariaLabel={`Menu azioni per ${doc.title}`}
            />
          )}
          filters={filters}
          onFilterChange={handleFilterChange}
          externalConfig={tableConfig.config ? {
            config: tableConfig.config,
            visibleColumns: visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue
          } : undefined}
        />
      </div>
    </ManagementLayout>
  );
}
