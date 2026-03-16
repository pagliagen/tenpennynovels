/**
 * Character Approvals Page
 *
 * Shortcut view for character_approval tickets
 */

import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { api } from '@/lib/api/client';
import { ListResponse } from '@/types/api/common';
import styles from '@/styles/pages/TicketList.module.scss';

interface TicketListParams {
  page: number;
  pageSize: number;
  status?: string;
  assignedToMe?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

export default function CharacterApprovals() {
  const router = useRouter();
  const { filters, params, setParams, handleFilterChange } = useTableFilters<TicketListParams>({
    page: 1,
    pageSize: 25,
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const tableConfig = useTableConfig('character-approvals');

  // Fetch tickets with fixed category filter
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'tickets', 'character-approvals', params],
    queryFn: async () => {
      // Fixed filter for character_approval category
      const queryString = api.buildQueryString({ ...params, category: 'character_approval' });
      const response = await api.get(`/admin/tickets${queryString}`) as ListResponse<any>;
      return {
        list: response.list || [],
        pagination: response.pagination || { totalItems: 0, totalPages: 1, currentPage: 1, pageSize: params.pageSize }
      };
    }
  });

  const tickets = data?.list || [];
  const pagination = data?.pagination || { totalItems: 0, totalPages: 1, currentPage: 1, pageSize: params.pageSize };

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(c => tableConfig.columnVisibility[c.key] !== false);
  }, [tableConfig.config, tableConfig.columnVisibility]);

  const handlePageChange = (page: number) => setParams({ ...params, page });
  const handlePageSizeChange = (pageSize: number) => setParams({ ...params, page: 1, pageSize });
  const handleSortChange = (sortBy?: string, sortOrder?: 'asc' | 'desc') => setParams({ ...params, sortBy, sortOrder });

  const handleAction = (action: string, ticket: any) => {
    switch (action) {
      case 'view-details':
        setSelectedTicketId(ticket.id);
        break;
      case 'go-to-pending':
        router.push('/characters/character-pending');
        break;
      default:
        console.log('Unknown action:', action, ticket);
    }
  };

  const totalItems = pagination?.totalItems ?? 0;

  return (
    <ManagementLayout>
      <Head>
        <title>Richieste Approvazione Personaggi</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Richieste Approvazione Personaggi</h1>
          <p className={styles.subtitle}>Ticket di approvazione personaggi</p>
          <div className={styles.headerActions}>
            <button
              onClick={() => router.push('/characters/character-pending')}
              className={styles.primaryButton}
            >
              📋 In Attesa Approvazione
            </button>
          </div>
        </div>

        <div className={styles.infoBox}>
          <strong>ℹ️ Info:</strong> Questo pannello mostra solo i ticket di richiesta approvazione personaggio.
          Per approvare/rifiutare il personaggio, usa il pannello <strong>In Attesa Approvazione</strong>.
          I ticket servono per comunicare con il player durante il processo di approvazione.
        </div>

        <ConfigurableDataTable<any>
          tableName="character-approvals"
          data={tickets}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          pagination={{
            page: params.page ?? 1,
            pageSize: params.pageSize ?? 25,
            total: totalItems,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
          }}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortChange={handleSortChange}
          filters={filters}
          onFilterChange={handleFilterChange}
          externalConfig={tableConfig.config ? {
            config: tableConfig.config,
            visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue,
          } : undefined}
        />

        {/* TODO: Add SidePanel for ticket detail */}
        {selectedTicketId && (
          <div className={styles.sidePanelOverlay} onClick={() => setSelectedTicketId(null)}>
            <div className={styles.sidePanel} onClick={(e) => e.stopPropagation()}>
              <div className={styles.sidePanelHeader}>
                <h2>Ticket #{selectedTicketId}</h2>
                <button onClick={() => setSelectedTicketId(null)}>✕</button>
              </div>
              <div className={styles.sidePanelContent}>
                <p>TODO: Implement TicketDetailContent component with character preview</p>
                <p>Ticket ID: {selectedTicketId}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}
