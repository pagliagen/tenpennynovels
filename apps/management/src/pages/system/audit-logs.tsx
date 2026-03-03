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
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useQuery } from '@tanstack/react-query';
import { systemAPI, AuditLog, AuditLogParams } from '@/lib/api/system';
import styles from '@/styles/pages/SystemConfig.module.scss';

export default function AuditLogs() {
  const [params, setParams] = useState<AuditLogParams>({
    page: 1,
    pageSize: 50
  });

  // Hooks
  const tableConfig = useTableConfig('audit-logs');
  const { data, isLoading, error } = useQuery({
    queryKey: ['system', 'audit-logs', params],
    queryFn: () => systemAPI.getAuditLogs(params)
  });

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

  // Filter handlers
  const handleCategoryChange = (category: string) => {
    setParams(prev => ({
      ...prev,
      category: category || undefined,
      page: 1
    }));
  };

  const handleSeverityChange = (severity: string) => {
    setParams(prev => ({
      ...prev,
      severity: (severity as 'info' | 'warning' | 'critical') || undefined,
      page: 1
    }));
  };

  const handleDateFromChange = (dateFrom: string) => {
    setParams(prev => ({
      ...prev,
      dateFrom: dateFrom || undefined,
      page: 1
    }));
  };

  const handleDateToChange = (dateTo: string) => {
    setParams(prev => ({
      ...prev,
      dateTo: dateTo || undefined,
      page: 1
    }));
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
        <title>Audit Logs - TenpennyNovels Management</title>
      </Head>

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1>📋 Log Audit</h1>
            <p>Cronologia completa azioni amministrative</p>
          </div>
        </header>

        {/* Filters */}
        <section className={styles.section}>
          <h2>Filtri</h2>
          <div className={styles.settingGrid}>
            <div className={styles.settingItem}>
              <label htmlFor="category">Categoria</label>
              <select
                id="category"
                value={params.category || ''}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">Tutte le categorie</option>
                <option value="character_management">Gestione Personaggi</option>
                <option value="user_management">Gestione Utenti</option>
                <option value="economy_management">Economia</option>
                <option value="system_configuration">Configurazione Sistema</option>
                <option value="moderation">Moderazione</option>
              </select>
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="severity">Gravità</label>
              <select
                id="severity"
                value={params.severity || ''}
                onChange={(e) => handleSeverityChange(e.target.value)}
              >
                <option value="">Tutte</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="dateFrom">Data Da</label>
              <input
                id="dateFrom"
                type="date"
                value={params.dateFrom || ''}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>

            <div className={styles.settingItem}>
              <label htmlFor="dateTo">Data A</label>
              <input
                id="dateTo"
                type="date"
                value={params.dateTo || ''}
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Table */}
        <ConfigurableDataTable<AuditLog>
          tableName="audit-logs"
          data={data?.items ?? []}
          loading={isLoading || tableConfig.loading}
          pagination={{
            page: params.page || 1,
            pageSize: params.pageSize || 50,
            total: data?.pagination?.totalItems ?? 0,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
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
