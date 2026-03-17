/**
 * PG Master List Page
 * Shows only characters with characterType='pg_master'
 */

import React, { useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useCharacters } from '@/hooks/api/useCharacters';
import type { Character, CharacterListParams } from '@/types/api/Character';
import styles from '@/styles/pages/CharacterList.module.scss';

export default function PGMasterList() {
  const router = useRouter();

  const { filters, params, setParams, handleFilterChange } = useTableFilters<CharacterListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'metadata.createdAt',
    sortOrder: 'desc',
    characterType: 'pg_master' // FILTER BY TYPE
  });

  const { data, isLoading } = useCharacters(params);
  const tableConfig = useTableConfig('pg-master-list');

  // Prepare visible columns for ConfigurableDataTable
  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(
      col => tableConfig.columnVisibility[col.key] !== false
    );
  }, [tableConfig.config, tableConfig.columnVisibility]);

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Master Characters</title>
      </Head>
      <div className={styles.characterList}>
        <header className={styles.header}>
          <h1>Master Characters</h1>
          <p>Totale: {data?.pagination.totalItems ?? 0} master</p>
        </header>
        <ConfigurableDataTable<Character>
          tableName="pg-master-list"
          data={data?.list ?? []}
          loading={isLoading || tableConfig.loading}
          pagination={{
            page: params.page,
            pageSize: params.pageSize,
            total: data?.pagination.totalItems ?? 0,
            onPageChange: (page) => setParams({ ...params, page }),
            onPageSizeChange: (pageSize) => setParams({ ...params, pageSize, page: 1 })
          }}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortChange={(sortBy, sortOrder) => setParams({ ...params, sortBy, sortOrder })}
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
