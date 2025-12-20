import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { TicketsLayout } from '@/components/TicketsLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { TicketDetailModal } from '@/components/tickets/TicketDetailModal';
import { ColumnVisibilityToggle } from '@/components/shared/ColumnVisibilityToggle';
import { AuthContext } from '@/lib/auth';
import { logUserAction } from '@/lib/auditLogger';
import { useTableConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/pages/TicketManagement.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

export interface TicketManagementItem {
  _id: string;
  ticketId: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  unreadMessagesCount: number;
  createdAt: string;
  updatedAt: string;
  characterName: string;
  assignedStaff?: {
    characterName: string;
  };
  department: string;
}

interface AllTicketsProps {
  authContext: AuthContext;
}

export default function AllTicketsPage({ authContext }: AllTicketsProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketManagementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<TicketManagementItem[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);

  // Table configuration with column visibility
  const { 
    config: tableConfig, 
    getNestedValue, 
    setNestedValue, 
    columnVisibility,
    toggleColumnVisibility,
    resetColumnVisibility,
    resolveConditionalValue,
    interpolateTemplate,
    allColumns
  } = useTableConfig('tickets-all');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: tableConfig?.table.pagination.defaultPageSize || 25,
    total: 0
  });

  const fetchTickets = async (page = 1, pageSize = 25) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets?page=${page}&pageSize=${pageSize}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Map API response to frontend format
      const mappedTickets = (data.data?.tickets || data.tickets || []).map((ticket: any) => ({
        _id: ticket.id,
        ticketId: ticket.id,
        title: ticket.title,
        category: ticket.category,
        status: ticket.status.toUpperCase(),
        priority: ticket.priority, // Mantieni lowercase per il mapping CSS
        unreadMessagesCount: ticket.messageCount || 0,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt || ticket.createdAt,
        characterName: ticket.createdBy?.name || 'Unknown',
        assignedToName: ticket.assignedTo?.name || null,
        department: ticket.department
      }));
      
      setTickets(mappedTickets);
      setPagination(prev => ({
        ...prev,
        page: data.pagination?.page || page,
        total: data.pagination?.total || mappedTickets.length
      }));
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento dei ticket');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableStaff = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/staff`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableStaff(data.staff || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  useEffect(() => {
    if (!authContext.isLoading) {
      fetchTickets(pagination.page, pagination.pageSize);
      fetchAvailableStaff();
    }
  }, [authContext.isLoading]);

  const handlePageChange = (newPage: number) => {
    fetchTickets(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: newSize }));
    fetchTickets(1, newSize);
  };

  // Handle table actions from configuration
  const handleAction = (actionKey: string, ticket: TicketManagementItem) => {
    switch (actionKey) {
      case 'view':
        setSelectedTicketId(ticket._id);
        break;
      case 'assign':
        // TODO: Implementare modal di assegnazione
        console.log('Assign ticket:', ticket.ticketId);
        break;
      default:
        console.warn(`Unknown action: ${actionKey}`);
    }
  };

  // Handle modal actions
  const handleModalAction = async (actionKey: string, formData?: Record<string, any>) => {
    try {
      setModalLoading(true);
      // Modal action completed successfully, refreshing data
      console.log('Modal action completed:', actionKey, formData);
      
      switch (actionKey) {
        case 'assign':
          // Implementare assegnazione
          break;
        case 'change_status':
          // Implementare cambio stato
          break;
        case 'transfer':
          // Implementare trasferimento
          break;
        case 'close':
          // Implementare chiusura
          break;
        default:
          console.warn(`Unknown modal action: ${actionKey}`);
      }
      
      // Ricarica la tabella dopo l'azione
      await loadTickets();
    } catch (error) {
      console.error('Modal action failed:', error);
      setError(`Azione fallita: ${error}`);
    } finally {
      setModalLoading(false);
    }
  };

  // Handle bulk actions from configuration
  const handleBulkAction = (actionKey: string, tickets: TicketManagementItem[]) => {
    switch (actionKey) {
      default:
        console.warn(`Unknown bulk action: ${actionKey}`);
    }
  };

  const loadTickets = async () => {
    // Ricarica la lista ticket dopo le azioni
    await fetchTickets(pagination.page, pagination.pageSize);
  };

  // Handle cell clicks for specific columns
  const handleCellClick = (ticket: TicketManagementItem, columnKey: string, value: any) => {
    // Click su ID ticket apre il modal dettagli
    if (columnKey === 'ticketId') {
      setSelectedTicketId(ticket._id);
    }
  };

  // Show loading screen while checking authentication
  if (authContext.isLoading) {
    return (
      <div style={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(212, 175, 55, 0.3)',
            borderLeft: '4px solid #d4af37',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#e8e8e8' }}>Verifica autorizzazioni...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Management - Tutti i Ticket</title>
      </Head>

      <div className={styles.userManagement}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>🎫 Tutti i Ticket</h1>
          <div className={styles.pageActions}>
            {tableConfig && (
              <ColumnVisibilityToggle
                allColumns={allColumns}
                columnVisibility={columnVisibility}
                onToggleColumn={toggleColumnVisibility}
                onResetToDefaults={resetColumnVisibility}
              />
            )}
            
            <button 
              onClick={() => fetchTickets(pagination.page, pagination.pageSize)}
              className={styles.refreshButton}
              disabled={loading}
            >
              <span className={styles.refreshIcon}>↻</span>
              Aggiorna
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
            <button 
              onClick={() => setError(null)}
              className={styles.closeError}
            >
              ✕
            </button>
          </div>
        )}

        <ConfigurableDataTable
          tableName="tickets-all"
          data={tickets}
          loading={loading}
          selectedItems={selectedTickets}
          onSelectionChange={setSelectedTickets}
          onAction={handleAction}
          onBulkAction={handleBulkAction}
          onCellClick={handleCellClick}
          pagination={{
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
          className={styles.usersTable}
          externalConfig={tableConfig ? {
            config: tableConfig,
            loading: false,
            error: null,
            visibleColumns: tableConfig.columns.filter(col => {
              if (col.alwaysVisible) return true;
              return columnVisibility[col.key] ?? col.defaultVisible;
            }),
            getNestedValue,
            resolveConditionalValue
          } : undefined}
        />

        {/* Ticket Detail Modal */}
        <TicketDetailModal
          ticketId={selectedTicketId || ''}
          isOpen={!!selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onAction={handleModalAction}
          loading={modalLoading}
          error={error}
          authContext={authContext}
        />
      </div>
    </>
  );
}