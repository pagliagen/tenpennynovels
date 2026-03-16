/**
 * Ticket List Page
 *
 * Complete ticket management with ConfigurableDataTable
 */

import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useNotificationStore } from '@/store/notificationStore';
import { api } from '@/lib/api/client';
import { ListResponse } from '@/types/api/common';
import styles from '@/styles/pages/TicketList.module.scss';

interface TicketListParams {
  page: number;
  pageSize: number;
  status?: string;
  category?: string;
  priority?: string;
  assignedToMe?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

export default function TicketList() {
  const { filters, params, setParams, handleFilterChange } = useTableFilters<TicketListParams>({
    page: 1,
    pageSize: 25,
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const tableConfig = useTableConfig('ticket-list');
  const addNotification = useNotificationStore(s => s.addNotification);

  // Fetch tickets
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'tickets', 'list', params],
    queryFn: async () => {
      const response = await api.get(`/admin/tickets${api.buildQueryString(params)}`) as ListResponse<any>;
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
      default:
        console.log('Unknown action:', action, ticket);
    }
  };

  const handleBulkAction = async (action: string, selectedIds: string[]) => {
    if (action === 'bulk-close') {
      if (!confirm(`Chiudere ${selectedIds.length} ticket?`)) return;

      try {
        await Promise.all(
          selectedIds.map(id =>
            api.put(`/admin/tickets/${id}/close`, { reason: 'Chiusura massiva da staff' })
          )
        );

        addNotification({
          type: 'success',
          message: `${selectedIds.length} ticket chiusi con successo`,
        });

        // Refetch data
        // queryClient.invalidateQueries(['admin', 'tickets', 'list']);
      } catch (error) {
        addNotification({
          type: 'error',
          message: 'Errore durante la chiusura dei ticket',
        });
      }
    }
  };

  const totalItems = data?.pagination?.totalItems ?? 0;

  return (
    <ManagementLayout>
      <Head>
        <title>Gestione Ticket</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Gestione Ticket</h1>
          <p className={styles.subtitle}>Lista completa ticket di supporto</p>
        </div>

        <ConfigurableDataTable<any>
          tableName="ticket-list"
          data={tickets}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          onBulkAction={handleBulkAction}
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
                <p>TODO: Implement TicketDetailContent component</p>
                <p>Ticket ID: {selectedTicketId}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}
