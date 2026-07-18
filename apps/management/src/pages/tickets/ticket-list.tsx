/**
 * Ticket List Page
 *
 * Complete ticket management with ConfigurableDataTable
 */

import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useQueryClient } from '@tanstack/react-query';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { TicketDetailSidePanel } from '@/components/tickets/TicketDetailSidePanel';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { useAdminTicketsListQuery, adminTicketsQueryKeys } from '@/hooks/api/useAdminTicketsList';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useNotificationStore } from '@/store/notificationStore';
import { api } from '@/lib/api/client';
import type { AdminTicketRow } from '@/types/api/AdminTicket';
import styles from '@/styles/pages/TicketList.module.scss';
import { logger } from '@/lib/logger';

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
  const queryClient = useQueryClient();
  const { filters, params, setParams, handleFilterChange } = useTableFilters<TicketListParams>({
    page: 1,
    pageSize: 25,
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const tableConfig = useTableConfig('ticket-list');
  const addNotification = useNotificationStore(s => s.addNotification);

  const { data, isLoading } = useAdminTicketsListQuery({
    variant: 'list',
    params,
  });

  const tickets = data?.list ?? [];
  const totalItems = data?.pagination?.totalItems ?? 0;

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(c => tableConfig.columnVisibility[c.key] !== false);
  }, [tableConfig.config, tableConfig.columnVisibility]);

  const handlePageChange = (page: number) => setParams({ ...params, page });
  const handlePageSizeChange = (pageSize: number) => setParams({ ...params, page: 1, pageSize });
  const handleSortChange = (sortBy?: string, sortOrder?: 'asc' | 'desc') =>
    setParams({ ...params, sortBy, sortOrder });

  const handleAction = (action: string, ticket: AdminTicketRow) => {
    switch (action) {
      case 'view-details':
        setSelectedTicketId(ticket.id);
        break;
      default:
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Unknown action:', { args: [action, ticket] });
        }
    }
  };

  const handleBulkAction = async (
    action: string,
    items: AdminTicketRow[],
    allPagesSelected?: boolean
  ) => {
    if (action === 'bulk-close') {
      if (allPagesSelected) {
        addNotification({
          type: 'error',
          message: 'Seleziona i ticket nella pagina corrente: la chiusura massiva su tutte le pagine non è supportata qui.',
        });
        return;
      }

      const selectedIds = items.map((row) => row.id).filter(Boolean);
      if (!selectedIds.length) return;

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

        await queryClient.invalidateQueries({ queryKey: adminTicketsQueryKeys.all });
      } catch {
        addNotification({
          type: 'error',
          message: 'Errore durante la chiusura dei ticket',
        });
      }
    }
  };

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

        <ConfigurableDataTable<AdminTicketRow>
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

        <TicketDetailSidePanel
          selectedTicketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      </div>
    </ManagementLayout>
  );
}
