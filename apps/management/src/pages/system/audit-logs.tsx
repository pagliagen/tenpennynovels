/**
 * Audit Logs Page
 *
 * Visualizzazione log audit sistema con filtri e paginazione.
 * Traccia tutte le azioni amministrative per compliance e debugging.
 *
 * @module pages/system/audit-logs
 */

import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable, FilterState } from '@/components/shared/ConfigurableDataTable';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useAuditLogs } from '@/hooks/api/useAuditLogs';
import { AuditLog, AuditLogParams } from '@/lib/api/system';
import { useURLFilter } from '@/hooks/useURLFilter';
import { clearFilterHash } from '@/lib/utils/urlFilters';
import styles from '@/styles/pages/SystemConfig.module.scss';

export default function AuditLogs() {
  const { filters, params, setParams, handleFilterChange } = useTableFilters<AuditLogParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'timestamp',
    sortOrder: 'desc'
  });
  const [selectedLogs, setSelectedLogs] = useState<AuditLog[]>([]);

  // Hooks
  const tableConfig = useTableConfig('audit-logs');
  const urlFilter = useURLFilter<{ userId?: string; characterId?: string }>();

  // Apply URL filter to params
  const filteredParams = useMemo(() => {
    if (urlFilter) {
      return { ...params, ...urlFilter };
    }
    return params;
  }, [params, urlFilter]);

  const { data, isLoading, error } = useAuditLogs(filteredParams);

  // Prepare visible columns
  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(
      col => tableConfig.columnVisibility[col.key] !== false
    );
  }, [tableConfig.config, tableConfig.columnVisibility]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setParams(prev => ({ ...prev, pageSize, page: 1 }));
  };

  /**
   * Handler sorting
   */
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
  };


  /**
   * Handler bulk actions
   */
  const handleBulkAction = async (actionKey: string, items: AuditLog[], allPagesSelected: boolean = false) => {
    // Audit logs are read-only, no bulk actions needed
    console.log('Bulk action not applicable for audit logs');
  };

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.error}>
          <h2>Errore nel caricamento log</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Audit Logs</title>
      </Head>

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1>📋 Log Audit</h1>
            <p>Cronologia completa azioni amministrative</p>
          </div>
        </header>

        {/* Filter Badge */}
        {(urlFilter?.userId || urlFilter?.characterId) && (
          <div className={styles.filterBadge}>
            <span className={styles.filterLabel}>
              🔓 Filtrato per {urlFilter.userId ? 'utente' : 'personaggio'}
            </span>
            <button
              className={styles.filterRemove}
              onClick={() => {
                clearFilterHash();
                window.location.reload();
              }}
              title="Rimuovi filtro"
            >
              ✕
            </button>
          </div>
        )}

        {/* Table */}
        <ConfigurableDataTable<AuditLog>
          tableName="audit-logs"
          data={data?.list ?? []}
          loading={isLoading || tableConfig.loading}
          pagination={{
            page: params.page || 1,
            pageSize: params.pageSize || 25,
            total: data?.pagination?.totalItems ?? 0,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortChange={handleSortChange}
          filters={filters}
          onFilterChange={handleFilterChange}
          selectedItems={selectedLogs}
          onSelectionChange={setSelectedLogs}
          onBulkAction={handleBulkAction}
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
