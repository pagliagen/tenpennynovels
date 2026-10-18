/**
 * SEO Documents Page
 *
 * Elenco di sola lettura di titoli e descrizioni SEO dei documenti (ConfigurableDataTable + TanStack Query).
 * Le descrizioni si modificano dalla scheda del documento.
 */

import React, { useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useSeoDocuments } from '@/hooks/api/useDocuments';
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
    return docs.filter(doc => doc.type === filters.type);
  }, [data?.documents, filters.type]);

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
