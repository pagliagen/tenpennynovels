/**
 * Character Approvals Page
 *
 * Shortcut view for character_approval tickets
 */

import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { TicketDetailSidePanel } from '@/components/tickets/TicketDetailSidePanel';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { useAdminTicketsListQuery } from '@/hooks/api/useAdminTicketsList';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import type { AdminTicketRow } from '@/types/api/AdminTicket';
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

  const { data, isLoading } = useAdminTicketsListQuery({
    variant: 'character-approvals',
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
      case 'go-to-pending':
        void router.push('/characters/character-pending');
        break;
      default:
        if (process.env.NODE_ENV === 'development') {
          console.warn('Unknown action:', action, ticket);
        }
    }
  };

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
              type="button"
              onClick={() => void router.push('/characters/character-pending')}
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

        <ConfigurableDataTable<AdminTicketRow>
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

        <TicketDetailSidePanel
          selectedTicketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      </div>
    </ManagementLayout>
  );
}
